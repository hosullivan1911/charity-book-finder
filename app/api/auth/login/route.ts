import { NextResponse } from "next/server";
import { masterShops } from "../../../../config/shops";
import {
  createShopSession,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
  shopCredentialsMatch,
  shopLoginIsConfigured,
} from "../../../../lib/shop-auth";

type LoginPayload = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (!shopLoginIsConfigured()) {
    return NextResponse.json(
      { error: "Shop login has not been configured in Vercel yet." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as LoginPayload;
  if (
    !payload.email ||
    !payload.password ||
    !shopCredentialsMatch(payload.email, payload.password)
  ) {
    return NextResponse.json(
      { error: "Email or password is incorrect." },
      { status: 401 },
    );
  }

  const shopSlug = process.env.SHOP_SLUG ?? masterShops[0]?.slug;
  const shop = masterShops.find((item) => item.slug === shopSlug);
  if (!shop) {
    return NextResponse.json(
      { error: "The login is not linked to a configured shop." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ authenticated: true, shop });
  response.cookies.set({
    name: SHOP_SESSION_COOKIE,
    value: createShopSession(shop.slug),
    httpOnly: true,
    maxAge: SHOP_SESSION_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
