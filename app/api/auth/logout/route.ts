import { NextResponse } from "next/server";
import { SHOP_SESSION_COOKIE } from "../../../../lib/shop-auth";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set({
    name: SHOP_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return response;
}
