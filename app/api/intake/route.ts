import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { books, inventory } from "../../../db/schema";
import { lookupIsbn } from "../../../lib/isbn";
import {
  getStaffSession,
  SHOP_SESSION_COOKIE,
} from "../../../lib/shop-auth";

type IntakePayload = {
  isbn?: string;
};

export async function POST(request: Request) {
  try {
    if (process.env.SITE_MODE === "catalogue") {
      return Response.json({ error: "Not found." }, { status: 404 });
    }

    const cookieStore = await cookies();
    const session = await getStaffSession(
      cookieStore.get(SHOP_SESSION_COOKIE)?.value,
    );
    if (!session) {
      return Response.json(
        { error: "Sign in to an approved shop before scanning books." },
        { status: 401 },
      );
    }

    const payload = (await request.json()) as IntakePayload;
    const isbn = payload.isbn?.trim() ?? "";

    if (!isbn) {
      return Response.json(
        { error: "An ISBN is required." },
        { status: 400 },
      );
    }

    const metadata = await lookupIsbn(isbn);

    try {
      const { db, shop, user } = session;

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
          // Retained only as hidden compatibility values for the first schema.
          // Giveleaf does not collect or display shelf, condition or pricing.
          shelfLocation: "",
          condition: "good",
          pricePence: 0,
          valuationConfidence: "not_used",
          valuationReasons: "[]",
          scannedBy: user.username,
        })
        .returning();

      return Response.json(
        { action: "added", book: metadata, inventoryId: stock.id, shop },
        { status: 201 },
      );
    } catch (databaseError) {
      return Response.json(
        {
          error:
            databaseError instanceof Error
              ? databaseError.message
              : "Inventory storage is temporarily unavailable.",
        },
        { status: 503 },
      );
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add this book." },
      { status: 400 },
    );
  }
}
