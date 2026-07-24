import type { BookMetadata } from "./types";

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

export async function lookupIsbn(isbnInput: string): Promise<BookMetadata> {
  const isbn13 = normaliseIsbn(isbnInput);
  if (!isValidIsbn13(isbn13)) {
    throw new Error("Enter or scan a valid 13-digit ISBN.");
  }

  const response = await fetch(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&jscmd=data&format=json`,
    {
      headers: { "User-Agent": "Giveleaf/0.1 (charity-book-finder)" },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error("The book lookup service is temporarily unavailable.");

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
        result.cover?.large ||
        result.cover?.medium ||
        `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
      subjects:
        result.subjects?.slice(0, 6).map((subject) => subject.name) || [],
      format: "Paperback",
    };
  }

  const searchResponse = await fetch(
    `https://openlibrary.org/search.json?isbn=${isbn13}&fields=title,author_name,publisher,first_publish_year,cover_i,subject&limit=1`,
    {
      headers: { "User-Agent": "Giveleaf/0.1 (charity-book-finder)" },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!searchResponse.ok) {
    throw new Error("The book lookup service is temporarily unavailable.");
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
    throw new Error("No book was found for that ISBN.");
  }

  return {
    isbn13,
    title: searchResult.title,
    author: searchResult.author_name?.join(", ") || "Unknown author",
    publisher: searchResult.publisher?.[0],
    publishedYear: searchResult.first_publish_year,
    coverUrl: searchResult.cover_i
      ? `https://covers.openlibrary.org/b/id/${searchResult.cover_i}-L.jpg`
      : `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects: searchResult.subject?.slice(0, 6) || [],
    format: "Paperback",
  };
}
