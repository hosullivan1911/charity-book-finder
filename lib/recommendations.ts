import type {
  BookRecommendation,
  InventoryBook,
} from "./types";

type TargetBook = {
  title: string;
  authors: string[];
  subjects: string[];
  publishedYear?: number;
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ignoredWords = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function tokens(value: string) {
  return normalise(value)
    .split(" ")
    .filter((token) => token.length > 1 && !ignoredWords.has(token));
}

function overlap(left: string[], right: string[]) {
  const rightSet = new Set(right.map(normalise));
  return left.map(normalise).filter((item) => item && rightSet.has(item));
}

function subjectTokens(subjects: string[]) {
  return [...new Set(subjects.flatMap(tokens))];
}

export function rankInStockAlternatives(
  query: string,
  target: TargetBook | null,
  candidates: InventoryBook[],
): BookRecommendation[] {
  const queryTokens = tokens(query);
  const targetTitleTokens = tokens(target?.title ?? query);
  const targetAuthorTokens = tokens(target?.authors.join(" ") ?? "");
  const targetSubjectTokens = subjectTokens(target?.subjects ?? []);

  return candidates
    .map((candidate) => {
      const candidateTitleTokens = tokens(candidate.title);
      const candidateAuthorTokens = tokens(candidate.author);
      const candidateSubjectTokens = subjectTokens(candidate.subjects);
      const titleMatches = overlap(targetTitleTokens, candidateTitleTokens);
      const queryMatches = overlap(queryTokens, [
        ...candidateTitleTokens,
        ...candidateAuthorTokens,
        ...candidateSubjectTokens,
      ]);
      const authorMatches = overlap(
        targetAuthorTokens,
        candidateAuthorTokens,
      );
      const subjectMatches = overlap(
        targetSubjectTokens,
        candidateSubjectTokens,
      );

      let score =
        subjectMatches.length * 7 +
        authorMatches.length * 10 +
        titleMatches.length * 4 +
        queryMatches.length * 3;

      if (
        target?.publishedYear &&
        candidate.publishedYear &&
        Math.abs(target.publishedYear - candidate.publishedYear) <= 5
      ) {
        score += 2;
      }

      const reasons: string[] = [];
      if (authorMatches.length) {
        reasons.push(`Another book connected to ${candidate.author}`);
      }
      if (subjectMatches.length) {
        const themes = subjectMatches.slice(0, 2).join(" and ");
        reasons.push(`Shares ${themes} themes`);
      }
      if (!reasons.length && (titleMatches.length || queryMatches.length)) {
        reasons.push("Closely matches the title, author or themes you searched");
      }
      if (!reasons.length && score === 0) {
        score = 0.1;
        reasons.push("A currently available book from a nearby charity shop");
      }

      return {
        inventoryId: candidate.inventoryId,
        reason: reasons[0],
        score,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.inventoryId - right.inventoryId,
    )
    .slice(0, 4);
}
