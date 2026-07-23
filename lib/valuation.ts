import type { BookCondition, BookMetadata, Valuation } from "./types";

const CURRENT_YEAR = new Date().getFullYear();

function roundToFiftyPence(value: number) {
  return Math.round(value / 50) * 50;
}

export function valueBook(
  book: BookMetadata,
  condition: BookCondition,
): Valuation {
  let price = book.format.toLowerCase().includes("hard") ? 350 : 250;
  const reasons: string[] = [];
  let evidence = 1;

  const subjects = book.subjects.join(" ").toLowerCase();
  const highDemand =
    /textbook|comput|business|psychology|health|cook|travel|art|design/.test(
      subjects,
    );
  const children = /juvenile|children|young adult/.test(subjects);
  const classic = /classic|literary/.test(subjects);

  if (highDemand) {
    price += 100;
    reasons.push("Higher-demand subject");
    evidence += 1;
  } else if (classic) {
    price += 50;
    reasons.push("Evergreen title or subject");
    evidence += 1;
  } else if (children) {
    price -= 50;
    reasons.push("Accessible children’s pricing");
    evidence += 1;
  }

  if (book.publishedYear) {
    const age = CURRENT_YEAR - book.publishedYear;
    evidence += 1;
    if (age <= 3) {
      price += 100;
      reasons.push("Published in the last three years");
    } else if (age > 15) {
      price -= 50;
      reasons.push("Older standard edition");
    }
  }

  if (condition === "like_new") {
    price += 100;
    reasons.push("Like-new condition");
  } else if (condition === "fair") {
    price -= 100;
    reasons.push("Visible wear");
  } else {
    reasons.push("Good condition");
  }

  const manualReview =
    Boolean(book.publishedYear && book.publishedYear < 1970) ||
    /first edition|signed|limited edition|antiquarian/.test(subjects);

  if (manualReview) {
    reasons.unshift("Possible collectible — check before shelving");
  }

  return {
    pricePence: Math.min(800, Math.max(100, roundToFiftyPence(price))),
    confidence: evidence >= 4 ? "high" : evidence >= 2 ? "medium" : "low",
    reasons: reasons.slice(0, 3),
    manualReview,
  };
}
