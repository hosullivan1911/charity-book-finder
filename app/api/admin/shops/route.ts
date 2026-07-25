import { eq } from "drizzle-orm";
import {
  shopInvites,
  shops,
  staffSessions,
  staffUsers,
} from "../../../../db/schema";
import { recordAuditEvent } from "../../../../lib/audit";
import { geocodeAustralianAddress } from "../../../../lib/geocode";
import { getManagementSession } from "../../../../lib/management";
import { shopSlugFromName } from "../../../../lib/shops";

type ShopPayload = {
  shopId?: number;
  name?: string;
  address?: string;
  postcode?: string;
  openingHours?: string;
  active?: boolean;
};

function cleanShopPayload(payload: ShopPayload) {
  const name = payload.name?.trim() ?? "";
  const address = payload.address?.trim() ?? "";
  const postcode = payload.postcode?.trim() ?? "";
  const openingHours = payload.openingHours?.trim() ?? "";
  if (name.length < 2 || name.length > 100) {
    return { error: "Enter a shop name between 2 and 100 characters." };
  }
  if (address.length < 5 || address.length > 180) {
    return { error: "Enter the shop's full Australian street address." };
  }
  if (!/^\d{4}$/.test(postcode)) {
    return { error: "Enter a four-digit Australian postcode." };
  }
  if (openingHours.length < 3 || openingHours.length > 180) {
    return { error: "Enter concise opening hours for customers." };
  }
  return { name, address, postcode, openingHours };
}

async function requireOwner() {
  const session = await getManagementSession();
  return session?.user.role === "admin" ? session : null;
}

export async function POST(request: Request) {
  const session = await requireOwner();
  if (!session) {
    return Response.json(
      { error: "Only the Giveleaf owner can add shops." },
      { status: 403 },
    );
  }
  const cleaned = cleanShopPayload((await request.json()) as ShopPayload);
  if ("error" in cleaned) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }

  const slug = shopSlugFromName(cleaned.name);
  if (!slug) {
    return Response.json({ error: "Enter a valid shop name." }, { status: 400 });
  }
  const [existing] = await session.db
    .select({ id: shops.id })
    .from(shops)
    .where(eq(shops.slug, slug))
    .limit(1);
  if (existing) {
    return Response.json(
      { error: "A shop with that name already exists." },
      { status: 409 },
    );
  }

  const location = await geocodeAustralianAddress(
    `${cleaned.address}, ${cleaned.postcode}, Australia`,
  );
  if (!location) {
    return Response.json(
      {
        error:
          "That address could not be located. Include the street, suburb, state and postcode.",
      },
      { status: 400 },
    );
  }

  const [shop] = await session.db
    .insert(shops)
    .values({
      slug,
      name: cleaned.name,
      address: cleaned.address,
      postcode: cleaned.postcode,
      openingHours: cleaned.openingHours,
      latitude: location.latitude,
      longitude: location.longitude,
      active: true,
    })
    .returning();
  await recordAuditEvent(session.db, {
    actor: session.user,
    shopId: shop.id,
    action: "shop.created",
    targetType: "shop",
    targetId: shop.id,
    details: { name: shop.name, postcode: shop.postcode },
  });
  return Response.json({ shop }, { status: 201 });
}

export async function PATCH(request: Request) {
  const session = await requireOwner();
  if (!session) {
    return Response.json(
      { error: "Only the Giveleaf owner can manage shops." },
      { status: 403 },
    );
  }
  const payload = (await request.json()) as ShopPayload;
  const shopId = Number(payload.shopId);
  const [current] = await session.db
    .select()
    .from(shops)
    .where(eq(shops.id, shopId))
    .limit(1);
  if (!current) {
    return Response.json({ error: "Shop not found." }, { status: 404 });
  }

  if (typeof payload.active === "boolean") {
    await session.db
      .update(shops)
      .set({ active: payload.active })
      .where(eq(shops.id, current.id));
    if (!payload.active) {
      await session.db
        .update(shopInvites)
        .set({ active: false })
        .where(eq(shopInvites.shopId, current.id));
      const users = await session.db
        .select({ id: staffUsers.id })
        .from(staffUsers)
        .where(eq(staffUsers.shopId, current.id));
      for (const user of users) {
        await session.db
          .delete(staffSessions)
          .where(eq(staffSessions.userId, user.id));
      }
    }
    await recordAuditEvent(session.db, {
      actor: session.user,
      shopId: current.id,
      action: payload.active ? "shop.reactivated" : "shop.archived",
      targetType: "shop",
      targetId: current.id,
      details: { name: current.name },
    });
    return Response.json({ updated: true });
  }

  const cleaned = cleanShopPayload(payload);
  if ("error" in cleaned) {
    return Response.json({ error: cleaned.error }, { status: 400 });
  }
  const location = await geocodeAustralianAddress(
    `${cleaned.address}, ${cleaned.postcode}, Australia`,
  );
  if (!location) {
    return Response.json(
      {
        error:
          "That address could not be located. Include the street, suburb, state and postcode.",
      },
      { status: 400 },
    );
  }

  await session.db
    .update(shops)
    .set({
      name: cleaned.name,
      address: cleaned.address,
      postcode: cleaned.postcode,
      openingHours: cleaned.openingHours,
      latitude: location.latitude,
      longitude: location.longitude,
    })
    .where(eq(shops.id, current.id));
  await recordAuditEvent(session.db, {
    actor: session.user,
    shopId: current.id,
    action: "shop.updated",
    targetType: "shop",
    targetId: current.id,
    details: { name: cleaned.name, postcode: cleaned.postcode },
  });
  return Response.json({ updated: true });
}
