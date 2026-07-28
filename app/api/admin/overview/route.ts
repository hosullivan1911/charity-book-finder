import { asc, count, desc, eq, max } from "drizzle-orm";
import {
  auditEvents,
  books,
  inventory,
  shopInvites,
  shops,
  staffUsers,
} from "../../../../db/schema";
import { getManagementSession } from "../../../../lib/management";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

function safeDetails(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function latestDate(values: Array<string | null>) {
  return values.reduce<string | null>(
    (latest, value) => (value && (!latest || value > latest) ? value : latest),
    null,
  );
}

export async function GET() {
  const session = await getManagementSession();
  if (!session) {
    return Response.json(
      { error: "A manager account is required." },
      { headers: NO_STORE_HEADERS, status: 403 },
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
      soldAt: inventory.soldAt,
      removedAt: inventory.removedAt,
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
  const inventoryCountRowsQuery = session.db
    .select({
      status: inventory.status,
      total: count(),
      lastListedAt: max(inventory.scannedAt),
      lastSoldAt: max(inventory.soldAt),
      lastRemovedAt: max(inventory.removedAt),
    })
    .from(inventory)
    .innerJoin(shops, eq(inventory.shopId, shops.id))
    .where(shopFilter)
    .groupBy(inventory.status);

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
  const [
    userRows,
    inviteRows,
    inventoryRows,
    inventoryCountRows,
    activityRows,
    shopRows,
  ] =
    await Promise.all([
      userRowsQuery,
      inviteRowsQuery,
      inventoryRowsQuery,
      inventoryCountRowsQuery,
      activityRowsQuery,
      shopRowsQuery,
    ]);

  const inventoryCounts = new Map(
    inventoryCountRows.map((row) => [row.status, Number(row.total)]),
  );
  const activeInventory = inventoryCounts.get("available") ?? 0;
  const sales = inventoryCounts.get("sold") ?? 0;
  const delistings = inventoryCounts.get("removed") ?? 0;
  const totalListings = [...inventoryCounts.values()].reduce(
    (total, value) => total + value,
    0,
  );
  const activeUsers = userRows.filter((user) => user.active).length;
  const now = Date.now();
  const listingsLastSevenDays = inventoryRows.filter(
    (item) =>
      new Date(item.scannedAt).getTime() >= now - 7 * 24 * 60 * 60 * 1000,
  ).length;

  return Response.json(
    {
      viewer: {
        id: session.user.id,
        username: session.user.username,
        role: session.user.role,
        shopId: session.shop?.id ?? null,
      },
      stats: {
        activeInventory,
        activeUsers,
        totalListings,
        sales,
        delistings,
        listingsLastSevenDays,
        lastListedAt: latestDate(
          inventoryCountRows.map((item) => item.lastListedAt),
        ),
        lastSoldAt: latestDate(
          inventoryCountRows.map((item) => item.lastSoldAt),
        ),
        lastRemovedAt: latestDate(
          inventoryCountRows.map((item) => item.lastRemovedAt),
        ),
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
    },
    { headers: NO_STORE_HEADERS },
  );
}
