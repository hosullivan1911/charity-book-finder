import { and, desc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { books, inventory, shops } from "../../../db/schema";
import {
  getStaffSession,
  SHOP_SESSION_COOKIE,
} from "../../../lib/shop-auth";
import { coverUrlForIsbn } from "../../../lib/isbn";
import type { InventoryBook } from "../../../lib/types";

type InventoryRow = {
  inventory: typeof inventory.$inferSelect;
  book: typeof books.$inferSelect;
  shop: typeof shops.$inferSelect;
};

type RemovalPayload = {
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
    coverUrl: row.book.coverUrl || coverUrlForIsbn(row.book.isbn13),
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

async function getAuthenticatedStaff() {
  if (process.env.SITE_MODE === "catalogue") return null;

  const cookieStore = await cookies();
  return getStaffSession(
    cookieStore.get(SHOP_SESSION_COOKIE)?.value,
  );
}

export async function GET() {
  try {
    const context = await getAuthenticatedStaff();
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
    const context = await getAuthenticatedStaff();
    if (!context) {
      return Response.json(
        { error: "Sign in before removing books." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as RemovalPayload;
    const inventoryId =
      typeof payload.inventoryId === "number" ? payload.inventoryId : null;

    if (!inventoryId) {
      return Response.json(
        { error: "Choose a book from the inventory to remove." },
        { status: 400 },
      );
    }

    const filters = [
      eq(inventory.shopId, context.shop.id),
      eq(inventory.status, "available"),
      eq(inventory.id, inventoryId),
    ];

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
          error: "That book is no longer in this shop's available inventory.",
        },
        { status: 404 },
      );
    }

    await context.db
      .update(inventory)
      .set({
        status: "removed",
      })
      .where(eq(inventory.id, stock.inventory.id));

    return Response.json({
      action: "removed",
      inventoryId: stock.inventory.id,
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
