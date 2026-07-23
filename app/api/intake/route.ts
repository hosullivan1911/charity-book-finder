import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { masterShops } from "../../../config/shops";
import { getDb } from "../../../db";
import { books, inventory } from "../../../db/schema";
import { syncMasterShops } from "../../../db/sync-master-shops";
import { lookupIsbn } from "../../../lib/isbn";
import type { BookCondition } from "../../../lib/types";
import { valueBook } from "../../../lib/valuation";
import { SHOP_SESSION_COOKIE, readShopSession } from "../../../lib/shop-auth";

type IntakePayload = {
  isbn?: string;
  shelfLocation?: string;
  condition?: BookCondition;
};

const allowedConditions: BookCondition[] = ["like_new", "good", "fair"];

export async function POST(request: Request) {
  try {
    if (process.env.SITE_MODE === "catalogue") {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const cookieStore = await cookies();
    const session = readShopSession(cookieStore.get(SHOP_SESSION_COOKIE)?.value);
    const masterShop = masterShops.find(
      (shop) => shop.slug === session?.shopSlug,
    );
    if (!masterShop) {
      return Response.json(
        { error: "Sign in to an approved shop before scanning books." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as IntakePayload;
    const isbn = payload.isbn?.trim() ?? "";
    const shelfLocation = payload.shelfLocation?.trim() ?? "";
    const condition = payload.condition ?? "good";

    if (!isbn || !shelfLocation) {
      return Response.json(
        { error: "ISBN, shop and shelf location are required." },
        { status: 400 },
      );
    }
    if (!allowedConditions.includes(condition)) {
      return Response.json({ error: "Invalid condition." }, { status: 400 });
    }

    const metadata = await lookupIsbn(isbn);
    const valuation = valueBook(metadata, condition);

    try {
      const db = await getDb();
      const syncedShops = await syncMasterShops(db);
      const shop = syncedShops.find((item) => item.slug === masterShop.slug);
      if (!shop) {
        return Response.json({ error: "That shop could not be found." }, { status: 404 });
      }

      await db
        .insert(books)
        .values({
          isbn13: metadata.isbn13,
          title: metadata.title,
          author: metadata.author,
          publisher: metadata.publisher,
          publishedYear: metadata.publishedYear,
          coverUrl: metadata.coverUrl,
          subjects: JSON.stringify(metadata.subjects),
          format: metadata.format,
        })
        .onConflictDoUpdate({
          target: books.isbn13,
          set: {
            title: metadata.title,
            author: metadata.author,
            publisher: metadata.publisher,
            publishedYear: metadata.publishedYear,
            coverUrl: metadata.coverUrl,
            subjects: JSON.stringify(metadata.subjects),
            updatedAt: new Date().toISOString(),
          },
        });

      const [book] = await db
        .select()
        .from(books)
        .where(eq(books.isbn13, metadata.isbn13))
        .limit(1);
      const [stock] = await db
        .insert(inventory)
        .values({
          bookId: book.id,
          shopId: shop.id,
          shelfLocation,
          condition,
          pricePence: valuation.pricePence,
          valuationConfidence: valuation.confidence,
          valuationReasons: JSON.stringify(valuation.reasons),
        })
        .returning();

      return Response.json(
        { book: metadata, valuation, inventoryId: stock.id, shop },
        { status: 201 },
      );
    } catch {
      return Response.json(
        {
          book: metadata,
          valuation,
          inventoryId: Date.now(),
          demo: true,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not value this book." },
      { status: 400 },
    );
  }
}
