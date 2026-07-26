import { asc, desc, eq } from "drizzle-orm";
import {
  auditEvents,
  books,
  inventory,
  shopInvites,
  shops,
  staffUsers,
} from "../../../../db/schema";
import { getManagementSession } from "../../../../lib/management";

function safeDetails(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function GET() {
  const session = await getManagementSession();
  if (!session) {
    return Response.json(
      { error: "A manager account is required." },
      { status: 403 },
    );
  }

  const shopFilter =
    session.user.role === "admin"
      ? undefined
      : eq(shops.id, session.shop!.id);
  const userRowsQuery = session.db
    .select({
      id: staffUsers.id,
      username: staffUsers.username,
      role: staffUsers.role,
      active: staffUsers.active,
      createdAt: staffUsers.createdAt,
      updatedAt: staffUsers.updatedAt,
      shopId: shops.id,
      shopSlug: shops.slug,
      shopName: shops.name,
    })
    .from(staffUsers)
    .leftJoin(shops, eq(staffUsers.shopId, shops.id))
    .where(shopFilter)
    .orderBy(desc(staffUsers.createdAt));

  const inviteRowsQuery = session.db
    .select({
      id: shopInvites.id,
      role: shopInvites.role,
      expiresAt: shopInvites.expiresAt,
      maxUses: shopInvites.maxUses,
      useCount: shopInvites.useCount,
      active: shopInvites.active,
      createdAt: shopInvites.createdAt,
      shopId: shops.id,
      shopSlug: shops.slug,
      shopName: shops.name,
    })
    .from(shopInvites)
    .innerJoin(shops, eq(shopInvites.shopId, shops.id))
    .where(shopFilter)
    .orderBy(desc(shopInvites.createdAt))
    .limit(100);

  const inventoryRowsQuery = session.db
    .select({
      id: inventory.id,
      status: inventory.status,
      scannedBy: inventory.scannedBy,
      scannedAt: inventory.scannedAt,
      removedBy: inventory.removedBy,
      removalReason: inventory.removalReason,
      removedAt: inventory.soldAt,
      isbn13: books.isbn13,
      title: books.title,
      author: books.author,
      coverUrl: books.coverUrl,
      shopId: shops.id,
      shopSlug: shops.slug,
      shopName: shops.name,
    })
    .from(inventory)
    .innerJoin(books, eq(inventory.bookId, books.id))
    .innerJoin(shops, eq(inventory.shopId, shops.id))
    .where(shopFilter)
    .orderBy(desc(inventory.updatedAt))
    .limit(1000);

  const auditFilter =
    session.user.role === "admin"
      ? undefined
      : eq(auditEvents.shopId, session.shop!.id);
  const activityRowsQuery = session.db
    .select()
    .from(auditEvents)
    .where(auditFilter)
    .orderBy(desc(auditEvents.createdAt))
    .limit(200);
  const shopRowsQuery = session.db
    .select()
    .from(shops)
    .where(shopFilter)
    .orderBy(asc(shops.name));
  const [userRows, inviteRows, inventoryRows, activityRows, shopRows] =
    await Promise.all([
      userRowsQuery,
      inviteRowsQuery,
      inventoryRowsQuery,
      activityRowsQuery,
      shopRowsQuery,
    ]);

  const activeInventory = inventoryRows.filter(
    (item) => item.status === "available",
  ).length;
  const activeUsers = userRows.filter((user) => user.active).length;
  const now = Date.now();
  const scansLastSevenDays = inventoryRows.filter(
    (item) =>
      new Date(item.scannedAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000,
  ).length;

  return Response.json({
    viewer: {
      id: session.user.id,
      username: session.user.username,
      role: session.user.role,
      shopId: session.shop?.id ?? null,
    },
    stats: {
      activeInventory,
      activeUsers,
      scansLastSevenDays,
      participatingShops: shopRows.filter((shop) => shop.active).length,
    },
    shops: shopRows,
    users: userRows,
    invites: inviteRows,
    inventory: inventoryRows,
    activity: activityRows.map((event) => ({
      ...event,
      details: safeDetails(event.details),
    })),
  });
}
