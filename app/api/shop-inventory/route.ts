import { and, desc, eq, inArray } from "drizzle-orm";
import { cookies } from "next/headers";
import { books, inventory, shops } from "../../../db/schema";
import {
  getStaffSession,
  SHOP_SESSION_COOKIE,
} from "../../../lib/shop-auth";
import { coverUrlForBook } from "../../../lib/isbn";
import { recordAuditEvent } from "../../../lib/audit";
import type { InventoryBook } from "../../../lib/types";

type InventoryRow = {
  inventory: typeof inventory.$inferSelect;
  book: typeof books.$inferSelect;
  shop: typeof shops.$inferSelect;
};

type RemovalPayload = {
  inventoryId?: number;
  action?: "sold" | "remove";
  reason?: string;
};

function mapInventoryRow(row: InventoryRow): InventoryBook {
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

async function getAuthenticatedStaff() {
  if (process.env.SITE_MODE === "catalogue") return null;

  const cookieStore = await cookies();
  const session = await getStaffSession(
    cookieStore.get(SHOP_SESSION_COOKIE)?.value,
  );
  if (!session?.shop) return null;
  return {
    ...session,
    shop: session.shop,
  };
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
    const action =
      payload.action === "sold"
        ? "sold"
        : payload.action === "remove"
          ? "removed"
          : null;

    if (!inventoryId || !action) {
      return Response.json(
        { error: "Choose a book and mark it as Sold or Remove." },
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

    const completedAt = new Date().toISOString();
    await context.db
      .update(inventory)
      .set({
        status: action,
        soldAt: action === "sold" ? completedAt : null,
        removedAt: action === "removed" ? completedAt : null,
        removedBy: context.user.username,
        removalReason:
          action === "removed"
            ? payload.reason?.trim() || "Removed from inventory"
            : null,
        updatedAt: completedAt,
      })
      .where(eq(inventory.id, stock.inventory.id));
    await recordAuditEvent(context.db, {
      actor: context.user,
      shopId: context.shop.id,
      action: action === "sold" ? "inventory.sold" : "inventory.removed",
      targetType: "inventory",
      targetId: stock.inventory.id,
      details: {
        isbn13: stock.book.isbn13,
        title: stock.book.title,
        outcome: action,
        source: "scanner",
      },
    });

    return Response.json({
      action,
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

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedStaff();
    if (!context) {
      return Response.json(
        { error: "Sign in before restoring books." },
        { status: 401 },
      );
    }
    const payload = (await request.json()) as { inventoryId?: number };
    const inventoryId = Number(payload.inventoryId);
    const [stock] = await context.db
      .select({ inventory, book: books })
      .from(inventory)
      .innerJoin(books, eq(inventory.bookId, books.id))
      .where(
        and(
          eq(inventory.id, inventoryId),
          eq(inventory.shopId, context.shop.id),
          inArray(inventory.status, ["sold", "removed"]),
        ),
      )
      .limit(1);
    if (!stock) {
      return Response.json(
        { error: "That removal can no longer be undone." },
        { status: 404 },
      );
    }

    const previousStatus = stock.inventory.status;
    await context.db
      .update(inventory)
      .set({
        status: "available",
        soldAt: null,
        removedAt: null,
        removedBy: null,
        removalReason: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventory.id, stock.inventory.id));
    await recordAuditEvent(context.db, {
      actor: context.user,
      shopId: context.shop.id,
      action: "inventory.restored",
      targetType: "inventory",
      targetId: stock.inventory.id,
      details: {
        isbn13: stock.book.isbn13,
        title: stock.book.title,
        previousStatus,
        source: "scanner_undo",
      },
    });
    return Response.json({ action: "restored", inventoryId });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not restore this book.",
      },
      { status: 503 },
    );
  }
}
