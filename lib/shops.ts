import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { shops } from "../db/schema";
import type { Shop } from "./types";

export function mapShop(row: typeof shops.$inferSelect): Shop {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    address: row.address,
    postcode: row.postcode,
    openingHours: row.openingHours,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

export async function listShops(
  db: Database,
  options: { activeOnly?: boolean } = {},
) {
  const rows = await db
    .select()
    .from(shops)
    .where(options.activeOnly === false ? undefined : eq(shops.active, true))
    .orderBy(asc(shops.name));
  return rows.map(mapShop);
}

export async function findShopBySlug(
  db: Database,
  slug: string,
  options: { activeOnly?: boolean } = {},
) {
  const filters = [eq(shops.slug, slug)];
  if (options.activeOnly !== false) filters.push(eq(shops.active, true));
  const [shop] = await db
    .select()
    .from(shops)
    .where(and(...filters))
    .limit(1);
  return shop ?? null;
}

export function shopSlugFromName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
