import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { masterShops } from "../../../../config/shops";
import { getDb } from "../../../../db";
import { staffUsers } from "../../../../db/schema";
import { syncMasterShops } from "../../../../db/sync-master-shops";
import {
  createStaffSession,
  hashPassword,
  normaliseUsername,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
  validatePassword,
  validateUsername,
} from "../../../../lib/shop-auth";

type RegistrationPayload = {
  username?: string;
  password?: string;
  shopSlug?: string;
};

export async function POST(request: Request) {
  if (process.env.SITE_MODE === "catalogue") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payload = (await request.json()) as RegistrationPayload;
  const username = normaliseUsername(payload.username ?? "");
  const password = payload.password ?? "";
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
      { error: "Choose a participating shop." },
      { status: 400 },
    );
  }

  const db = await getDb();
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

  const syncedShops = await syncMasterShops(db);
  const shop = syncedShops.find((item) => item.slug === configuredShop.slug);
  if (!shop) {
    return NextResponse.json(
      { error: "That shop could not be linked to the account." },
      { status: 503 },
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
      })
      .returning();
  } catch {
    return NextResponse.json(
      { error: "That username is already in use." },
      { status: 409 },
    );
  }

  const token = await createStaffSession(user.id);
  const response = NextResponse.json(
    {
      authenticated: true,
      username: user.username,
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
