import { masterShops } from "../config/shops";
import type { Database } from ".";
import { shops } from "./schema";

export async function syncMasterShops(db: Database) {
  const syncedShops = [];
  for (const masterShop of masterShops) {
    const [shop] = await db
      .insert(shops)
      .values({
        slug: masterShop.slug,
        name: masterShop.name,
        address: masterShop.address,
        postcode: masterShop.postcode,
        latitude: masterShop.latitude,
        longitude: masterShop.longitude,
        openingHours: masterShop.openingHours,
        active: true,
      })
      .onConflictDoUpdate({
        target: shops.slug,
        set: {
          name: masterShop.name,
          address: masterShop.address,
          postcode: masterShop.postcode,
          latitude: masterShop.latitude,
          longitude: masterShop.longitude,
          openingHours: masterShop.openingHours,
          active: true,
        },
      })
      .returning();
    syncedShops.push(shop);
  }

  return syncedShops;
}
