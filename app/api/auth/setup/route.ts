import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  OWNER_SETUP_CODE_SHA256,
} from "../../../../config/launch";
import { masterShops } from "../../../../config/shops";
import { getDb } from "../../../../db";
import { staffUsers } from "../../../../db/schema";
import { syncMasterShops } from "../../../../db/sync-master-shops";
import { recordAuditEvent } from "../../../../lib/audit";
import {
  authRateLimitKey,
  checkAuthRateLimit,
  clearAuthRateLimit,
  recordAuthFailure,
} from "../../../../lib/rate-limit";
import {
  createStaffSession,
  hashPassword,
  normaliseUsername,
  secureHashMatches,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
  validatePassword,
  validateUsername,
} from "../../../../lib/shop-auth";

type SetupPayload = {
  setupCode?: string;
  username?: string;
  password?: string;
  shopSlug?: string;
};

export async function POST(request: Request) {
  if (process.env.SITE_MODE === "catalogue") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payload = (await request.json()) as SetupPayload;
  const username = normaliseUsername(payload.username ?? "");
  const password = payload.password ?? "";
  const setupCode = payload.setupCode?.trim() ?? "";
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(password);
  if (usernameError || passwordError) {
    return NextResponse.json(
      { error: usernameError || passwordError },
      { status: 400 },
    );
  }

  const configuredShop = masterShops.find(
    (shop) => shop.slug === payload.shopSlug,
  );
  if (!configuredShop) {
    return NextResponse.json(
      { error: "Choose the shop your owner account belongs to." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const rateLimitKey = authRateLimitKey(request, "owner-setup", username);
  const blockedMinutes = await checkAuthRateLimit(db, rateLimitKey);
  if (blockedMinutes) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${blockedMinutes} minutes.` },
      { status: 429 },
    );
  }

  const [userCount] = await db.select({ total: count() }).from(staffUsers);
  if (Number(userCount?.total ?? 0) > 0) {
    return NextResponse.json(
      { error: "Owner setup is already complete. Sign in instead." },
      { status: 409 },
    );
  }
  if (!secureHashMatches(setupCode, OWNER_SETUP_CODE_SHA256)) {
    await recordAuthFailure(db, rateLimitKey);
    return NextResponse.json(
      { error: "The one-time owner setup code is incorrect." },
      { status: 403 },
    );
  }

  const syncedShops = await syncMasterShops(db);
  const shop = syncedShops.find((item) => item.slug === configuredShop.slug);
  if (!shop) {
    return NextResponse.json(
      { error: "The selected shop could not be prepared." },
      { status: 503 },
    );
  }

  const [user] = await db
    .insert(staffUsers)
    .values({
      username,
      passwordHash: await hashPassword(password),
      shopId: shop.id,
      role: "admin",
      active: true,
    })
    .returning();
  await recordAuditEvent(db, {
    actor: user,
    shopId: shop.id,
    action: "owner.bootstrapped",
    targetType: "staff_user",
    targetId: user.id,
  });
  await clearAuthRateLimit(db, rateLimitKey);

  const token = await createStaffSession(user.id);
  const response = NextResponse.json(
    {
      authenticated: true,
      username: user.username,
      role: user.role,
      shop: configuredShop,
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
