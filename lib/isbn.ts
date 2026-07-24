import type { BookMetadata } from "./types";
import { siteConfig } from "../config/site";

const BOOK_LOOKUP_HEADERS = {
  Accept: "application/json",
  "User-Agent": `Giveleaf/1.0 (${siteConfig.supportEmail})`,
};

export function normaliseIsbn(value: string) {
  return value.replace(/[^0-9X]/gi, "").toUpperCase();
}

export function isValidIsbn13(value: string) {
  const isbn = normaliseIsbn(value);
  if (!/^\d{13}$/.test(isbn)) return false;
  const total = isbn
    .slice(0, 12)
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === Number(isbn[12]);
}

export function isbn10ForIsbn13(value: string) {
  const isbn13 = normaliseIsbn(value);
  if (!isValidIsbn13(isbn13) || !isbn13.startsWith("978")) return null;

  const body = isbn13.slice(3, 12);
  const weightedTotal = body
    .split("")
    .reduce(
      (sum, digit, index) => sum + Number(digit) * (10 - index),
      0,
    );
  const checkValue = (11 - (weightedTotal % 11)) % 11;

  return `${body}${checkValue === 10 ? "X" : checkValue}`;
}

export function coverUrlForIsbn(isbn13: string) {
  const coverIsbn = isbn10ForIsbn13(isbn13) || normaliseIsbn(isbn13);
  return `https://covers.openlibrary.org/b/isbn/${coverIsbn}-L.jpg?default=false`;
}

export function coverUrlForBook(
  isbn13: string,
  storedCoverUrl?: string | null,
) {
  const secureCoverUrl = storedCoverUrl?.replace(/^http:/, "https:");
  if (!secureCoverUrl) return coverUrlForIsbn(isbn13);

  try {
    const parsedCoverUrl = new URL(secureCoverUrl);
    const oldIsbnPath = `/b/isbn/${normaliseIsbn(isbn13)}-L.jpg`;

    // Earlier scans stored this Open Library ISBN-13 fallback even when the
    // real cover was indexed only under the equivalent ISBN-10. Upgrade those
    // URLs as inventory is read, without requiring a database migration.
    if (
      parsedCoverUrl.hostname === "covers.openlibrary.org" &&
      parsedCoverUrl.pathname === oldIsbnPath
    ) {
      return coverUrlForIsbn(isbn13);
    }
  } catch {
    return coverUrlForIsbn(isbn13);
  }

  return secureCoverUrl;
}

export async function lookupIsbn(isbnInput: string): Promise<BookMetadata> {
  const isbn13 = normaliseIsbn(isbnInput);
  if (!isValidIsbn13(isbn13)) {
    throw new Error("Enter or scan a valid 13-digit ISBN.");
  }

  const response = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`,
    {
      headers: BOOK_LOOKUP_HEADERS,
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) {
    const googleResult = await lookupGoogleBooks(isbn13).catch(() => null);
    if (googleResult) return googleResult;
    throw new Error("Book lookup services are temporarily unavailable.");
  }

  const payload = (await response.json()) as Record<
    string,
    {
      title?: string;
      authors?: Array<{ name: string }>;
      publishers?: Array<{ name: string }>;
      publish_date?: string;
      cover?: { large?: string; medium?: string };
      subjects?: Array<{ name: string }>;
    }
  >;
  const result = payload[`ISBN:${isbn13}`];
  if (result?.title) {
    const yearMatch = result.publish_date?.match(/\b(18|19|20)\d{2}\b/);
    return {
      isbn13,
      title: result.title,
      author:
        result.authors?.map((author) => author.name).join(", ") ||
        "Unknown author",
      publisher: result.publishers?.[0]?.name,
      publishedYear: yearMatch ? Number(yearMatch[0]) : undefined,
      coverUrl:
        (result.cover?.large || result.cover?.medium)?.replace(
          /^http:/,
          "https:",
        ) || coverUrlForIsbn(isbn13),
      subjects:
        result.subjects?.slice(0, 6).map((subject) => subject.name) || [],
      format: "Paperback",
    };
  }

  const searchResponse = await fetch(
    `https://openlibrary.org/search.json?isbn=${isbn13}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`,
    {
      headers: BOOK_LOOKUP_HEADERS,
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!searchResponse.ok) {
    const googleResult = await lookupGoogleBooks(isbn13).catch(() => null);
    if (googleResult) return googleResult;
    throw new Error("Book lookup services are temporarily unavailable.");
  }

  const searchPayload = (await searchResponse.json()) as {
    docs?: Array<{
      title?: string;
      author_name?: string[];
      publisher?: string[];
      first_publish_year?: number;
      cover_i?: number;
      subject?: string[];
    }>;
  };
  const searchResult = searchPayload.docs?.[0];
  if (!searchResult?.title) {
    const googleResult = await lookupGoogleBooks(isbn13).catch(() => null);
    if (googleResult) return googleResult;
    throw new Error(
      "No book was found for that ISBN. Check the number or ask a manager for help.",
    );
  }

  return {
    isbn13,
    title: searchResult.title,
    author: searchResult.author_name?.join(", ") || "Unknown author",
    publisher: searchResult.publisher?.[0],
    publishedYear: searchResult.first_publish_year,
    coverUrl: searchResult.cover_i
      ? `https://covers.openlibrary.org/b/id/${searchResult.cover_i}-L.jpg`
      : coverUrlForIsbn(isbn13),
    subjects: searchResult.subject?.slice(0, 6) || [],
    format: "Paperback",
  };
}

async function lookupGoogleBooks(isbn13: string): Promise<BookMetadata | null> {
  const params = new URLSearchParams({
    q: `isbn:${isbn13}`,
    maxResults: "1",
    printType: "books",
  });
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    params.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }
  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params.toString()}`,
    {
      headers: BOOK_LOOKUP_HEADERS,
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
        categories?: string[];
        imageLinks?: {
          thumbnail?: string;
          smallThumbnail?: string;
        };
      };
    }>;
  };
  const info = payload.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const year = info.publishedDate?.match(/\b(18|19|20)\d{2}\b/)?.[0];
  const coverUrl = (
    info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail
  )?.replace(/^http:/, "https:");

  return {
    isbn13,
    title: info.title,
    author: info.authors?.join(", ") || "Unknown author",
    publisher: info.publisher,
    publishedYear: year ? Number(year) : undefined,
    coverUrl: coverUrl || coverUrlForIsbn(isbn13),
    subjects: info.categories?.slice(0, 6) || [],
    format: "Paperback",
  };
}
