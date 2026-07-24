import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { masterShops } from "../../../../config/shops";
import { shopInvites } from "../../../../db/schema";
import { syncMasterShops } from "../../../../db/sync-master-shops";
import { recordAuditEvent } from "../../../../lib/audit";
import { getManagementSession } from "../../../../lib/management";
import { hashOpaqueToken } from "../../../../lib/shop-auth";

type InvitePayload = {
  shopSlug?: string;
  role?: string;
  expiresInDays?: number;
  maxUses?: number;
};

export async function POST(request: Request) {
  const session = await getManagementSession();
  if (!session) {
    return Response.json({ error: "Manager access required." }, { status: 403 });
  }

  const payload = (await request.json()) as InvitePayload;
  const configuredShop = masterShops.find(
    (shop) => shop.slug === payload.shopSlug,
  );
  if (!configuredShop) {
    return Response.json({ error: "Choose a valid shop." }, { status: 400 });
  }
  const role =
    payload.role === "manager" && session.user.role === "admin"
      ? "manager"
      : "staff";
  const expiresInDays = Math.min(
    30,
    Math.max(1, Number(payload.expiresInDays) || 7),
  );
  const maxUses = Math.min(25, Math.max(1, Number(payload.maxUses) || 1));
  const syncedShops = await syncMasterShops(session.db);
  const shop = syncedShops.find((item) => item.slug === configuredShop.slug);
  if (
    !shop ||
    (session.user.role !== "admin" && shop.id !== session.shop.id)
  ) {
    return Response.json(
      { error: "You cannot create invitations for that shop." },
      { status: 403 },
    );
  }

  const code = `GL-${randomBytes(6).toString("hex").toUpperCase()}`;
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [invite] = await session.db
    .insert(shopInvites)
    .values({
      codeHash: hashOpaqueToken(code),
      shopId: shop.id,
      role,
      createdBy: session.user.id,
      expiresAt,
      maxUses,
    })
    .returning();
  await recordAuditEvent(session.db, {
    actor: session.user,
    shopId: shop.id,
    action: "invite.created",
    targetType: "shop_invite",
    targetId: invite.id,
    details: { role, maxUses, expiresAt },
  });

  return Response.json(
    {
      invite: {
        id: invite.id,
        code,
        shopName: configuredShop.name,
        role,
        expiresAt,
        maxUses,
      },
    },
    { status: 201 },
  );
}

export async function DELETE(request: Request) {
  const session = await getManagementSession();
  if (!session) {
    return Response.json({ error: "Manager access required." }, { status: 403 });
  }
  const payload = (await request.json()) as { inviteId?: number };
  const inviteId = Number(payload.inviteId);
  const [invite] = await session.db
    .select()
    .from(shopInvites)
    .where(eq(shopInvites.id, inviteId))
    .limit(1);
  if (
    !invite ||
    (session.user.role !== "admin" && invite.shopId !== session.shop.id)
  ) {
    return Response.json({ error: "Invitation not found." }, { status: 404 });
  }

  await session.db
    .update(shopInvites)
    .set({ active: false })
    .where(and(eq(shopInvites.id, invite.id), eq(shopInvites.active, true)));
  await recordAuditEvent(session.db, {
    actor: session.user,
    shopId: invite.shopId,
    action: "invite.revoked",
    targetType: "shop_invite",
    targetId: invite.id,
  });
  return Response.json({ revoked: true });
}

