import { getDb } from "../../../db";
import { listShops } from "../../../lib/shops";

export async function GET() {
  try {
    const db = await getDb();
    return Response.json({
      shops: await listShops(db),
      source: "database",
    });
  } catch {
    return Response.json(
      {
        shops: [],
        source: "unavailable",
        error: "Participating shops are temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
