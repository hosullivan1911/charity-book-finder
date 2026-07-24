import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { staffUsers } from "../../../../db/schema";
import {
  createStaffSession,
  normaliseUsername,
  passwordMatches,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
} from "../../../../lib/shop-auth";

type LoginPayload = {
  username?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (process.env.SITE_MODE === "catalogue") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const payload = (await request.json()) as LoginPayload;
  const username = normaliseUsername(payload.username ?? "");
  const password = payload.password ?? "";
  const db = await getDb();
  const [user] = await db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.username, username))
    .limit(1);

  if (!user || !(await passwordMatches(password, user.passwordHash))) {
    return NextResponse.json(
      { error: "Username or password is incorrect." },
      { status: 401 },
    );
  }

  const token = await createStaffSession(user.id);
  const response = NextResponse.json({
    authenticated: true,
    username: user.username,
  });
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
