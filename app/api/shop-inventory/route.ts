import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { masterShops } from "../../../config/shops";
import { getDb } from "../../../db";
import { books, inventory, shops } from "../../../db/schema";
import { syncMasterShops } from "../../../db/sync-master-shops";
import {
  SHOP_SESSION_COOKIE,
  readShopSession,
} from "../../../lib/shop-auth";
import type { BookMetadata, InventoryBook } from "../../../lib/types";

type InventoryRow = {
  inventory: typeof inventory.$inferSelect;
  book: typeof books.$inferSelect;
  shop: typeof shops.$inferSelect;
};

type RemovalPayload = {
  isbn?: string;
  inventoryId?: number;
};

function mapInventoryRow(row: InventoryRow): InventoryBook {
  return {
    inventoryId: row.inventory.id,
    isbn13: row.book.isbn13,
    title: row.book.title,
    author: row.book.author,
    publisher: row.book.publisher,
    publishedYear: row.book.publishedYear,
    coverUrl: row.book.coverUrl,
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
    shelfLocation: row.inventory.shelfLocation,
    condition: row.inventory.condition as InventoryBook["condition"],
    scannedAt: row.inventory.scannedAt,
  };
}

function mapBook(row: typeof books.$inferSelect): BookMetadata {
  return {
    isbn13: row.isbn13,
    title: row.title,
    author: row.author,
    publisher: row.publisher ?? undefined,
    publishedYear: row.publishedYear ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    subjects: JSON.parse(row.subjects) as string[],
    format: row.format,
  };
}

async function getAuthenticatedShop() {
  if (process.env.SITE_MODE === "catalogue") return null;

  const cookieStore = await cookies();
  const session = readShopSession(
    cookieStore.get(SHOP_SESSION_COOKIE)?.value,
  );
  const masterShop = masterShops.find(
    (shop) => shop.slug === session?.shopSlug,
  );
  if (!masterShop) return null;

  const db = await getDb();
  const syncedShops = await syncMasterShops(db);
  const shop = syncedShops.find((item) => item.slug === masterShop.slug);
  return shop ? { db, shop } : null;
}

export async function GET() {
  try {
    const context = await getAuthenticatedShop();
    if (!context) {
      return Response.json(
        { error: "Sign in to view this shop's inventory." },
        { status: 401 },
      );
    }

    const rows = await context.db
      .select({ inventory, book: books, shop: shops })
      .from(inventory)
      .innerJoin(books, eq(inventory.bookId, books.id))
      .innerJoin(shops, eq(inventory.shopId, shops.id))
      .where(
        and(
          eq(inventory.shopId, context.shop.id),
          eq(inventory.status, "available"),
        ),
      )
      .orderBy(desc(inventory.scannedAt))
      .limit(500);

    return Response.json({ inventory: rows.map(mapInventoryRow) });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not load this shop's inventory.",
      },
      { status: 503 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthenticatedShop();
    if (!context) {
      return Response.json(
        { error: "Sign in before removing books." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as RemovalPayload;
    const isbn = payload.isbn?.replace(/\D/g, "") ?? "";
    const inventoryId =
      typeof payload.inventoryId === "number" ? payload.inventoryId : null;

    if (!inventoryId && isbn.length !== 13) {
      return Response.json(
        { error: "Scan a valid 13-digit ISBN or choose an inventory item." },
        { status: 400 },
      );
    }

    const filters = [
      eq(inventory.shopId, context.shop.id),
      eq(inventory.status, "available"),
    ];
    if (inventoryId) filters.push(eq(inventory.id, inventoryId));
    if (isbn) filters.push(eq(books.isbn13, isbn));

    const [stock] = await context.db
      .select({ inventory, book: books, shop: shops })
      .from(inventory)
      .innerJoin(books, eq(inventory.bookId, books.id))
      .innerJoin(shops, eq(inventory.shopId, shops.id))
      .where(and(...filters))
      .orderBy(desc(inventory.scannedAt))
      .limit(1);

    if (!stock) {
      return Response.json(
        {
          error: isbn
            ? "No available copy of that ISBN is listed at this shop."
            : "That book is no longer in this shop's available inventory.",
        },
        { status: 404 },
      );
    }

    await context.db
      .update(inventory)
      .set({
        status: "sold",
        soldAt: new Date().toISOString(),
      })
      .where(eq(inventory.id, stock.inventory.id));

    return Response.json({
      action: "removed",
      inventoryId: stock.inventory.id,
      book: mapBook(stock.book),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not remove this book.",
      },
      { status: 503 },
    );
  }
}
