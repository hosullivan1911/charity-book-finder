import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import { masterShops } from "../config/shops";
import { getDb } from "../db";
import { shops, staffSessions, staffUsers } from "../db/schema";

export const SHOP_SESSION_COOKIE = "giveleaf_staff_session";
export const SHOP_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

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

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createStaffSession(userId: number) {
  const db = await getDb();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SHOP_SESSION_MAX_AGE * 1000,
  ).toISOString();

  await db.insert(staffSessions).values({
    tokenHash: hashSessionToken(token),
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
    .where(eq(staffSessions.tokenHash, hashSessionToken(token)));
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
      },
      shop: shops,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffSessions.userId, staffUsers.id))
    .innerJoin(shops, eq(staffUsers.shopId, shops.id))
    .where(
      and(
        eq(staffSessions.tokenHash, hashSessionToken(token)),
        gt(staffSessions.expiresAt, new Date().toISOString()),
        eq(shops.active, true),
      ),
    )
    .limit(1);

  if (!session) return null;
  const configuredShop = masterShops.find(
    (shop) => shop.slug === session.shop.slug,
  );
  if (!configuredShop) return null;

  return {
    db,
    user: session.user,
    shop: session.shop,
    configuredShop,
  };
}
