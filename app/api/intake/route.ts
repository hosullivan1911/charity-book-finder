import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { books, inventory } from "../../../db/schema";
import {
  coverUrlForIsbn,
  isValidIsbn13,
  lookupIsbn,
  normaliseIsbn,
} from "../../../lib/isbn";
import type { BookMetadata } from "../../../lib/types";
import { recordAuditEvent } from "../../../lib/audit";
import {
  getStaffSession,
  SHOP_SESSION_COOKIE,
} from "../../../lib/shop-auth";

type IntakePayload = {
  isbn?: string;
  manual?: {
    title?: string;
    author?: string;
    coverUrl?: string;
  };
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
    if (!session?.shop) {
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

    let metadata: BookMetadata;
    try {
      metadata = await lookupIsbn(isbn);
    } catch (lookupError) {
      const isbn13 = normaliseIsbn(isbn);
      const title = payload.manual?.title?.trim() ?? "";
      const author = payload.manual?.author?.trim() ?? "";
      const coverUrl = payload.manual?.coverUrl?.trim() ?? "";
      if (!isValidIsbn13(isbn13) || !title || !author) throw lookupError;
      if (coverUrl && !/^https:\/\//i.test(coverUrl)) {
        throw new Error("The optional cover must use a full HTTPS URL.");
      }
      metadata = {
        isbn13,
        title,
        author,
        coverUrl: coverUrl || coverUrlForIsbn(isbn13),
        subjects: [],
        format: "Paperback",
      };
    }

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
      await recordAuditEvent(db, {
        actor: user,
        shopId: shop.id,
        action: "inventory.added",
        targetType: "inventory",
        targetId: stock.id,
        details: {
          bookId: book.id,
          isbn13: book.isbn13,
          title: book.title,
        },
      });

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
