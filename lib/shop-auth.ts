import { createHmac, timingSafeEqual } from "node:crypto";

export const SHOP_SESSION_COOKIE = "spine_shop_session";
export const SHOP_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

type ShopSession = {
  shopSlug: string;
  expiresAt: number;
};

function getSessionSecret() {
  const secret = process.env.SHOP_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SHOP_SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function safelyMatches(value: string, expected: string) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return (
    valueBuffer.length === expectedBuffer.length &&
    timingSafeEqual(valueBuffer, expectedBuffer)
  );
}

export function shopLoginIsConfigured() {
  return Boolean(
    process.env.SHOP_LOGIN_EMAIL &&
      process.env.SHOP_LOGIN_PASSWORD &&
      process.env.SHOP_SESSION_SECRET &&
      process.env.SHOP_SESSION_SECRET.length >= 32,
  );
}

export function shopCredentialsMatch(email: string, password: string) {
  const expectedEmail = process.env.SHOP_LOGIN_EMAIL;
  const expectedPassword = process.env.SHOP_LOGIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;

  return (
    safelyMatches(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) &&
    safelyMatches(password, expectedPassword)
  );
}

export function createShopSession(shopSlug: string) {
  const session: ShopSession = {
    shopSlug,
    expiresAt: Date.now() + SHOP_SESSION_MAX_AGE * 1000,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readShopSession(token?: string): ShopSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    if (!safelyMatches(signature, sign(payload))) return null;
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as ShopSession;
    if (!session.shopSlug || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
