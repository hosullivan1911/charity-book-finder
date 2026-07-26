import { getDb } from "../../../db";
import { listPublicInventory } from "../../../lib/catalogue";
import { listShops } from "../../../lib/shops";

export async function GET() {
  try {
    const db = await getDb();
    const [inventory, shops] = await Promise.all([
      listPublicInventory(db),
      listShops(db),
    ]);
    return Response.json(
      { inventory, shops, source: "database" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15",
        },
      },
    );
  } catch {
    return Response.json(
      {
        inventory: [],
        shops: [],
        source: "unavailable",
        error: "The live catalogue is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
