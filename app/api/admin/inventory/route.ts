import { eq } from "drizzle-orm";
import { books, inventory } from "../../../../db/schema";
import { recordAuditEvent } from "../../../../lib/audit";
import { getManagementSession } from "../../../../lib/management";
import { canManageShop } from "../../../../lib/shop-auth";

type InventoryPayload = {
  inventoryId?: number;
  action?: "edit" | "remove" | "restore";
  title?: string;
  author?: string;
  coverUrl?: string;
  reason?: string;
};

export async function PATCH(request: Request) {
  const session = await getManagementSession();
  if (!session) {
    return Response.json({ error: "Manager access required." }, { status: 403 });
  }
  const payload = (await request.json()) as InventoryPayload;
  const inventoryId = Number(payload.inventoryId);
  const [target] = await session.db
    .select({ inventory, book: books })
    .from(inventory)
    .innerJoin(books, eq(inventory.bookId, books.id))
    .where(eq(inventory.id, inventoryId))
    .limit(1);
  if (
    !target ||
    !canManageShop(
      session.user.role,
      session.shop.id,
      target.inventory.shopId,
    )
  ) {
    return Response.json({ error: "Inventory item not found." }, { status: 404 });
  }

  if (payload.action === "edit") {
    const title = payload.title?.trim() ?? "";
    const author = payload.author?.trim() ?? "";
    const coverUrl = payload.coverUrl?.trim() || null;
    if (!title || !author) {
      return Response.json(
        { error: "Title and author are required." },
        { status: 400 },
      );
    }
    if (coverUrl && !/^https:\/\//i.test(coverUrl)) {
      return Response.json(
        { error: "Cover image must use a full HTTPS URL." },
        { status: 400 },
      );
    }
    await session.db
      .update(books)
      .set({
        title,
        author,
        coverUrl,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(books.id, target.book.id));
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.inventory.shopId,
      action: "book.metadata_updated",
      targetType: "book",
      targetId: target.book.id,
      details: { isbn13: target.book.isbn13, title, author },
    });
    return Response.json({ updated: true });
  }

  if (payload.action === "remove") {
    await session.db
      .update(inventory)
      .set({
        status: "removed",
        soldAt: new Date().toISOString(),
        removedBy: session.user.username,
        removalReason: payload.reason?.trim() || "Removed by manager",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventory.id, target.inventory.id));
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.inventory.shopId,
      action: "inventory.removed",
      targetType: "inventory",
      targetId: target.inventory.id,
      details: { isbn13: target.book.isbn13, source: "admin" },
    });
    return Response.json({ updated: true });
  }

  if (payload.action === "restore") {
    await session.db
      .update(inventory)
      .set({
        status: "available",
        soldAt: null,
        removedBy: null,
        removalReason: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(inventory.id, target.inventory.id));
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.inventory.shopId,
      action: "inventory.restored",
      targetType: "inventory",
      targetId: target.inventory.id,
      details: { isbn13: target.book.isbn13 },
    });
    return Response.json({ updated: true });
  }

  return Response.json({ error: "Choose a valid action." }, { status: 400 });
}
