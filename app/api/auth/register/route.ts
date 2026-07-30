import { and, eq, gt, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { shopInvites, shops, staffUsers } from "../../../../db/schema";
import { recordAuditEvent } from "../../../../lib/audit";
import {
  authRateLimitKey,
  checkAuthRateLimit,
  clearAuthRateLimit,
  recordAuthFailure,
} from "../../../../lib/rate-limit";
import {
  createStaffSession,
  hashOpaqueToken,
  hashPassword,
  normaliseUsername,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
  validatePassword,
  validateUsername,
} from "../../../../lib/shop-auth";
import { mapShop } from "../../../../lib/shops";

type RegistrationPayload = {
  username?: string;
  password?: string;
  inviteCode?: string;
};

export async function POST(request: Request) {
  if (process.env.SITE_MODE === "catalogue") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payload = (await request.json()) as RegistrationPayload;
  const username = normaliseUsername(payload.username ?? "");
  const password = payload.password ?? "";
  const inviteCode = payload.inviteCode?.trim().toUpperCase() ?? "";
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);
  if (usernameError || passwordError) {
    return NextResponse.json(
      { error: usernameError || passwordError },
      { status: 400 },
    );
  }

  const db = await getDb();
  const rateLimitKey = authRateLimitKey(request, "register", username);
  const blockedMinutes = await checkAuthRateLimit(db, rateLimitKey);
  if (blockedMinutes) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${blockedMinutes} minutes.` },
      { status: 429 },
    );
  }

  const [invite] = await db
    .select()
    .from(shopInvites)
    .where(
      and(
        eq(shopInvites.codeHash, hashOpaqueToken(inviteCode)),
        eq(shopInvites.active, true),
        gt(shopInvites.expiresAt, new Date().toISOString()),
        lt(shopInvites.useCount, shopInvites.maxUses),
      ),
    )
    .limit(1);
  if (!invite) {
    await recordAuthFailure(db, rateLimitKey);
    return NextResponse.json(
      { error: "That invitation code is invalid, expired or already used." },
      { status: 403 },
    );
  }

  const [shop] = await db
    .select()
    .from(shops)
    .where(and(eq(shops.id, invite.shopId), eq(shops.active, true)))
    .limit(1);
  if (!shop) {
    await recordAuthFailure(db, rateLimitKey);
    return NextResponse.json(
      { error: "The shop for that invitation is no longer available." },
      { status: 403 },
    );
  }

  const [existingUser] = await db
    .select({ id: staffUsers.id })
    .from(staffUsers)
    .where(eq(staffUsers.username, username))
    .limit(1);
  if (existingUser) {
    return NextResponse.json(
      { error: "That username is already in use." },
      { status: 409 },
    );
  }

  let user: typeof staffUsers.$inferSelect;
  try {
    [user] = await db
      .insert(staffUsers)
      .values({
        username,
        passwordHash: await hashPassword(password),
        shopId: shop.id,
        role: invite.role,
      })
      .returning();
  } catch {
    return NextResponse.json(
      { error: "That username is already in use." },
      { status: 409 },
    );
  }

  const nextUseCount = invite.useCount + 1;
  await db
    .update(shopInvites)
    .set({
      useCount: nextUseCount,
      active: nextUseCount < invite.maxUses,
    })
    .where(eq(shopInvites.id, invite.id));
  await recordAuditEvent(db, {
    actor: user,
    shopId: shop.id,
    action: "staff.registered",
    targetType: "staff_user",
    targetId: user.id,
    details: { role: user.role, inviteId: invite.id },
  });
  await clearAuthRateLimit(db, rateLimitKey);

  const token = await createStaffSession(user.id);
  const response = NextResponse.json(
    {
      authenticated: true,
      username: user.username,
      role: user.role,
      shop: mapShop(shop),
    },
    { status: 201 },
  );
  response.cookies.set({
    name: SHOP_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    maxAge: SHOP_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
