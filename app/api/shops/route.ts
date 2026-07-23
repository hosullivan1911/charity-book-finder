import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { shops } from "../../../db/schema";
import { demoShops } from "../../../lib/demo-data";

export async function GET() {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(shops)
      .where(eq(shops.active, true))
      .orderBy(asc(shops.name));
    return Response.json({ shops: rows.length ? rows : demoShops });
  } catch {
    return Response.json({ shops: demoShops });
  }
}
