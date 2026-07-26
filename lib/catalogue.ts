import { and, desc, eq, like, or } from "drizzle-orm";
import type { Database } from "../db";
import { books, inventory, shops } from "../db/schema";
import { coverUrlForBook } from "./isbn";
import type { InventoryBook } from "./types";

function mapRow(row: {
  inventory: typeof inventory.$inferSelect;
  book: typeof books.$inferSelect;
  shop: typeof shops.$inferSelect;
}): InventoryBook {
  return {
    inventoryId: row.inventory.id,
    isbn13: row.book.isbn13,
    title: row.book.title,
    author: row.book.author,
    publisher: row.book.publisher,
    publishedYear: row.book.publishedYear,
    coverUrl: coverUrlForBook(row.book.isbn13, row.book.coverUrl),
    format: row.book.format,
    subjects: JSON.parse(row.book.subjects) as string[],
    shop: {
      id: row.shop.id,
      slug: row.shop.slug,
      name: row.shop.name,
      address: row.shop.address,
      postcode: row.shop.postcode,
      openingHours: row.shop.openingHours,
      latitude: row.shop.latitude,
      longitude: row.shop.longitude,
    },
    scannedAt: row.inventory.scannedAt,
  };
}

export async function listPublicInventory(
  db: Database,
  options: { query?: string; shopSlug?: string; limit?: number } = {},
) {
  const filters = [
    eq(inventory.status, "available"),
    eq(shops.active, true),
  ];
  const query = options.query?.trim() ?? "";
  const shopSlug = options.shopSlug?.trim() ?? "";
  if (query) {
    const match = `%${query}%`;
    filters.push(
      or(
        like(books.title, match),
        like(books.author, match),
        like(books.isbn13, match),
      )!,
    );
  }
  if (shopSlug) filters.push(eq(shops.slug, shopSlug));

  const rows = await db
    .select({ inventory, book: books, shop: shops })
    .from(inventory)
    .innerJoin(books, eq(inventory.bookId, books.id))
    .innerJoin(shops, eq(inventory.shopId, shops.id))
    .where(and(...filters))
    .orderBy(desc(inventory.scannedAt))
    .limit(options.limit ?? 100);

  return rows.map(mapRow);
}
