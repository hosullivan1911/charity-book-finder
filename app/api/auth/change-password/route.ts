import { eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { staffSessions, staffUsers } from "../../../../db/schema";
import { recordAuditEvent } from "../../../../lib/audit";
import {
  createStaffSession,
  getStaffSession,
  hashPassword,
  hashOpaqueToken,
  passwordMatches,
  SHOP_SESSION_COOKIE,
  SHOP_SESSION_MAX_AGE,
  validatePassword,
} from "../../../../lib/shop-auth";

type PasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(SHOP_SESSION_COOKIE)?.value;
  const session = await getStaffSession(currentToken);
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const payload = (await request.json()) as PasswordPayload;
  const currentPassword = payload.currentPassword ?? "";
  const newPassword = payload.newPassword ?? "";
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const [storedUser] = await session.db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.id, session.user.id))
    .limit(1);
  if (
    !storedUser ||
    !(await passwordMatches(currentPassword, storedUser.passwordHash))
  ) {
    return NextResponse.json(
      { error: "Your current password is incorrect." },
      { status: 403 },
    );
  }

  await session.db
    .update(staffUsers)
    .set({
      passwordHash: await hashPassword(newPassword),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(staffUsers.id, session.user.id));
  if (currentToken) {
    await session.db
      .delete(staffSessions)
      .where(
        ne(staffSessions.tokenHash, hashOpaqueToken(currentToken)),
      );
  }
  await recordAuditEvent(session.db, {
    actor: session.user,
    shopId: session.shop?.id ?? null,
    action: "staff.password_changed",
    targetType: "staff_user",
    targetId: session.user.id,
  });

  const token = await createStaffSession(session.user.id);
  if (currentToken) {
    await session.db
      .delete(staffSessions)
      .where(eq(staffSessions.tokenHash, hashOpaqueToken(currentToken)));
  }
  const response = NextResponse.json({ changed: true });
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
