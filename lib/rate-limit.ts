import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { authRateLimits } from "../db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function authRateLimitKey(
  request: Request,
  scope: string,
  subject: string,
) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    "unknown";
  return createHash("sha256")
    .update(`${scope}:${address}:${subject}`)
    .digest("base64url");
}

export async function checkAuthRateLimit(db: Database, key: string) {
  const [record] = await db
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.key, key))
    .limit(1);
  if (!record?.blockedUntil) return null;

  const remainingMs = new Date(record.blockedUntil).getTime() - Date.now();
  if (remainingMs <= 0) return null;
  return Math.max(1, Math.ceil(remainingMs / 60_000));
}

export async function recordAuthFailure(db: Database, key: string) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(authRateLimits)
    .where(eq(authRateLimits.key, key))
    .limit(1);
  const existingWindow = existing
    ? new Date(existing.windowStartedAt).getTime()
    : 0;
  const withinWindow = Date.now() - existingWindow < WINDOW_MS;
  const attemptCount = withinWindow ? (existing?.attemptCount ?? 0) + 1 : 1;
  const blockedUntil =
    attemptCount >= MAX_ATTEMPTS
      ? new Date(Date.now() + BLOCK_MS).toISOString()
      : null;

  await db
    .insert(authRateLimits)
    .values({
      key,
      attemptCount,
      windowStartedAt: withinWindow
        ? existing!.windowStartedAt
        : now.toISOString(),
      blockedUntil,
      updatedAt: now.toISOString(),
    })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        attemptCount,
        windowStartedAt: withinWindow
          ? existing!.windowStartedAt
          : now.toISOString(),
        blockedUntil,
        updatedAt: now.toISOString(),
      },
    });
}

export async function clearAuthRateLimit(db: Database, key: string) {
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}

