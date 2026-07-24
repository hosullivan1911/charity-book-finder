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

  const prototypeFixtures: Record<string, BookMetadata> = {
    "9780571364909": {
      isbn13,
      title: "Klara and the Sun",
      author: "Kazuo Ishiguro",
      publisher: "Faber & Faber",
      publishedYear: 2021,
      coverUrl: "https://covers.openlibrary.org/b/isbn/9780571364909-L.jpg",
      subjects: ["Fiction", "Literary"],
      format: "Paperback",
    },
  };
  if (prototypeFixtures[isbn13]) return prototypeFixtures[isbn13];

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
  if (!result?.title) {
    throw new Error("No book was found for that ISBN. Add it manually for now.");
  }

  const yearMatch = result.publish_date?.match(/\b(18|19|20)\d{2}\b/);
  return {
    isbn13,
    title: result.title,
    author: result.authors?.map((author) => author.name).join(", ") || "Unknown author",
    publisher: result.publishers?.[0]?.name,
    publishedYear: yearMatch ? Number(yearMatch[0]) : undefined,
    coverUrl:
      result.cover?.large ||
      result.cover?.medium ||
      `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`,
    subjects: result.subjects?.slice(0, 6).map((subject) => subject.name) || [],
    format: "Paperback",
  };
}
