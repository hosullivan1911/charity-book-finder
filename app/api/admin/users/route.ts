import { eq } from "drizzle-orm";
import { masterShops } from "../../../../config/shops";
import { shopInvites, staffSessions, staffUsers } from "../../../../db/schema";
import { syncMasterShops } from "../../../../db/sync-master-shops";
import { recordAuditEvent } from "../../../../lib/audit";
import { getManagementSession } from "../../../../lib/management";
import {
  canManageShop,
  hashPassword,
  validatePassword,
} from "../../../../lib/shop-auth";

type UserPayload = {
  userId?: number;
  action?: "set-active" | "update" | "reset-password" | "delete";
  active?: boolean;
  role?: string;
  shopSlug?: string;
  temporaryPassword?: string;
};

export async function PATCH(request: Request) {
  const session = await getManagementSession();
  if (!session) {
    return Response.json({ error: "Manager access required." }, { status: 403 });
  }
  const payload = (await request.json()) as UserPayload;
  const userId = Number(payload.userId);
  const [target] = await session.db
    .select()
    .from(staffUsers)
    .where(eq(staffUsers.id, userId))
    .limit(1);
  if (
    !target ||
    !canManageShop(session.user.role, session.shop.id, target.shopId) ||
    (session.user.role === "manager" && target.role !== "staff")
  ) {
    return Response.json({ error: "Staff account not found." }, { status: 404 });
  }
  if (
    target.id === session.user.id &&
    (
      payload.action === "set-active" ||
      payload.action === "delete" ||
      payload.action === "reset-password" ||
      payload.action === "update"
    )
  ) {
    return Response.json(
      {
        error:
          "Use the Account section to change your own password. Another owner must change your role or shop.",
      },
      { status: 400 },
    );
  }

  if (payload.action === "set-active") {
    const active = Boolean(payload.active);
    await session.db
      .update(staffUsers)
      .set({ active, updatedAt: new Date().toISOString() })
      .where(eq(staffUsers.id, target.id));
    if (!active) {
      await session.db
        .delete(staffSessions)
        .where(eq(staffSessions.userId, target.id));
    }
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.shopId,
      action: active ? "staff.enabled" : "staff.disabled",
      targetType: "staff_user",
      targetId: target.id,
      details: { username: target.username },
    });
    return Response.json({ updated: true });
  }

  if (payload.action === "reset-password") {
    const temporaryPassword = payload.temporaryPassword ?? "";
    const passwordError = validatePassword(temporaryPassword);
    if (passwordError) {
      return Response.json({ error: passwordError }, { status: 400 });
    }
    await session.db
      .update(staffUsers)
      .set({
        passwordHash: await hashPassword(temporaryPassword),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(staffUsers.id, target.id));
    await session.db
      .delete(staffSessions)
      .where(eq(staffSessions.userId, target.id));
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.shopId,
      action: "staff.password_reset",
      targetType: "staff_user",
      targetId: target.id,
      details: { username: target.username },
    });
    return Response.json({ updated: true });
  }

  if (payload.action === "update") {
    if (session.user.role !== "admin") {
      return Response.json(
        { error: "Only the Giveleaf owner can reassign roles or shops." },
        { status: 403 },
      );
    }
    const configuredShop = masterShops.find(
      (shop) => shop.slug === payload.shopSlug,
    );
    const role =
      payload.role === "admin" || payload.role === "manager"
        ? payload.role
        : "staff";
    if (!configuredShop) {
      return Response.json({ error: "Choose a valid shop." }, { status: 400 });
    }
    const syncedShops = await syncMasterShops(session.db);
    const shop = syncedShops.find((item) => item.slug === configuredShop.slug);
    if (!shop) {
      return Response.json({ error: "Shop not found." }, { status: 404 });
    }
    await session.db
      .update(staffUsers)
      .set({
        shopId: shop.id,
        role,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(staffUsers.id, target.id));
    await session.db
      .delete(staffSessions)
      .where(eq(staffSessions.userId, target.id));
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: shop.id,
      action: "staff.updated",
      targetType: "staff_user",
      targetId: target.id,
      details: {
        username: target.username,
        previousShopId: target.shopId,
        role,
      },
    });
    return Response.json({ updated: true });
  }

  if (payload.action === "delete") {
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: target.shopId,
      action: "staff.deleted",
      targetType: "staff_user",
      targetId: target.id,
      details: { username: target.username },
    });
    await session.db
      .update(shopInvites)
      .set({ createdBy: null })
      .where(eq(shopInvites.createdBy, target.id));
    await session.db.delete(staffUsers).where(eq(staffUsers.id, target.id));
    return Response.json({ deleted: true });
  }

  return Response.json({ error: "Choose a valid action." }, { status: 400 });
}
