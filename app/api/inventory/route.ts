import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { books, inventory, shops } from "../../../db/schema";
import { coverUrlForBook } from "../../../lib/isbn";
import type { InventoryBook } from "../../../lib/types";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const shopSlug = searchParams.get("shop")?.trim() ?? "";

  try {
    const db = await getDb();
    const filters = [
      eq(inventory.status, "available"),
      eq(shops.active, true),
    ];
    if (query) {
      const match = `%${query}%`;
      filters.push(
        or(like(books.title, match), like(books.author, match), like(books.isbn13, match))!,
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
      .limit(100);

    return Response.json({ inventory: rows.map(mapRow), source: "database" });
  } catch {
    return Response.json(
      {
        inventory: [],
        source: "unavailable",
        error: "Live inventory is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
