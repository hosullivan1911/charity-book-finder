import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  deleteStaffSession,
  SHOP_SESSION_COOKIE,
} from "../../../../lib/shop-auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SHOP_SESSION_COOKIE)?.value;
  try {
    await deleteStaffSession(token);
  } catch {
    // The browser session should still be cleared if the database is offline.
  }

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
