import { getDb } from "../../../db";
import { listPublicInventory } from "../../../lib/catalogue";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim() ?? "";
  const shopSlug = searchParams.get("shop")?.trim() ?? "";

  try {
    const db = await getDb();
    return Response.json({
      inventory: await listPublicInventory(db, { query, shopSlug }),
      source: "database",
    });
  } catch {
    return Response.json(
      {
        inventory: [],
        source: "unavailable",
        error: "Live inventory is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
