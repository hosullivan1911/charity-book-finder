import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, count, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { shops, staffSessions, staffUsers } from "../db/schema";
import { mapShop } from "./shops";

export const SHOP_SESSION_COOKIE = "giveleaf_staff_session";
export const SHOP_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export type StaffRole = "admin" | "manager" | "staff";

export function normaliseUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const username = normaliseUsername(value);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    return "Use 3–32 letters, numbers, dots, hyphens or underscores.";
  }
  return null;
}

export function validatePassword(value: string) {
  if (value.length < 10) return "Use a password with at least 10 characters.";
  if (value.length > 128) return "Password must be 128 characters or fewer.";
  return null;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export async function passwordMatches(password: string, storedHash: string) {
  const [algorithm, saltValue, keyValue] = storedHash.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expectedKey = Buffer.from(keyValue, "base64url");
    const suppliedKey = (await scrypt(
      password,
      salt,
      expectedKey.length,
    )) as Buffer;
    return (
      suppliedKey.length === expectedKey.length &&
      timingSafeEqual(suppliedKey, expectedKey)
    );
  } catch {
    return false;
  }
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function secureHashMatches(value: string, expectedHexHash: string) {
  const actual = Buffer.from(
    createHash("sha256").update(value).digest("hex"),
    "utf8",
  );
  const expected = Buffer.from(expectedHexHash, "utf8");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createStaffSession(userId: number) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SHOP_SESSION_MAX_AGE * 1000,
  ).toISOString();

  await db.insert(staffSessions).values({
    tokenHash: hashOpaqueToken(token),
    userId,
    expiresAt,
  });
  return token;
}

export async function deleteStaffSession(token?: string) {
  if (!token) return;
  const db = await getDb();
  await db
    .delete(staffSessions)
    .where(eq(staffSessions.tokenHash, hashOpaqueToken(token)));
}

export async function hasStaffUsers() {
  const db = await getDb();
  const [result] = await db.select({ total: count() }).from(staffUsers);
  return Number(result?.total ?? 0) > 0;
}

export async function getStaffSession(token?: string) {
  if (!token) return null;

  const db = await getDb();
  const [session] = await db
    .select({
      user: {
        id: staffUsers.id,
        username: staffUsers.username,
        shopId: staffUsers.shopId,
        role: staffUsers.role,
        active: staffUsers.active,
      },
      shop: shops,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffSessions.userId, staffUsers.id))
    .leftJoin(
      shops,
      and(
        eq(staffUsers.shopId, shops.id),
        eq(shops.active, true),
      ),
    )
    .where(
      and(
        eq(staffSessions.tokenHash, hashOpaqueToken(token)),
        gt(staffSessions.expiresAt, new Date().toISOString()),
        eq(staffUsers.active, true),
      ),
    )
    .limit(1);

  if (!session) return null;
  const shop = session.shop;
  if (session.user.role !== "admin" && !shop) return null;

  return {
    db,
    user: session.user,
    shop: shop ?? null,
    configuredShop: shop ? mapShop(shop) : null,
  };
}

export function isManagementRole(role: string): role is "admin" | "manager" {
  return role === "admin" || role === "manager";
}

export function canManageShop(
  role: string,
  userShopId: number | null,
  shopId: number | null,
) {
  return (
    role === "admin" ||
    (role === "manager" && userShopId !== null && userShopId === shopId)
  );
}
