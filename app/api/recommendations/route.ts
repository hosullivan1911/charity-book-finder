import {
  rankInStockAlternatives,
} from "../../../lib/recommendations";
import { siteConfig } from "../../../config/site";
import type {
  InventoryBook,
} from "../../../lib/types";

type RecommendationPayload = {
  query?: string;
  candidates?: InventoryBook[];
};

type OpenLibraryDocument = {
  title?: string;
  author_name?: string[];
  subject?: string[];
  first_publish_year?: number;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as RecommendationPayload;
    const query = payload.query?.trim() ?? "";
    const candidates = Array.isArray(payload.candidates)
      ? payload.candidates.slice(0, 200)
      : [];

    if (query.length < 2) {
      return Response.json(
        { error: "Search for a book before asking for alternatives." },
        { status: 400 },
      );
    }
    if (!candidates.length) {
      return Response.json({ recommendations: [], source: "content-model" });
    }

    let target: {
      title: string;
      authors: string[];
      subjects: string[];
      publishedYear?: number;
    } | null = null;

    try {
      const params = new URLSearchParams({
        q: query,
        limit: "1",
        fields: "title,author_name,subject,first_publish_year",
      });
      const response = await fetch(
        `https://openlibrary.org/search.json?${params.toString()}`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": `Giveleaf/1.0 (${siteConfig.supportEmail})`,
          },
          next: { revalidate: 86_400 },
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (response.ok) {
        const data = (await response.json()) as {
          docs?: OpenLibraryDocument[];
        };
        const match = data.docs?.[0];
        if (match?.title) {
          target = {
            title: match.title,
            authors: match.author_name?.slice(0, 3) ?? [],
            subjects: match.subject?.slice(0, 30) ?? [],
            publishedYear: match.first_publish_year,
          };
        }
      }
    } catch {
      // Query-token ranking remains available if metadata enrichment is offline.
    }

    return Response.json({
      recommendations: rankInStockAlternatives(query, target, candidates),
      source: target ? "content-model" : "query-model",
      interpretedAs: target
        ? {
            title: target.title,
            author: target.authors[0] ?? null,
          }
        : null,
    });
  } catch {
    return Response.json(
      { error: "Could not generate alternatives right now." },
      { status: 400 },
    );
  }
}
