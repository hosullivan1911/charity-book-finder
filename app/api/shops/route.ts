import { masterShops } from "../../../config/shops";

export async function GET() {
  return Response.json({ shops: masterShops, source: "config" });
}
