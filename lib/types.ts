export type BookCondition = "like_new" | "good" | "fair";

export type Shop = {
  id: number;
  slug: string;
  name: string;
  address: string;
  postcode: string;
  openingHours: string;
  distance?: string;
};

export type InventoryBook = {
  inventoryId: number;
  isbn13: string;
  title: string;
  author: string;
  publisher?: string | null;
  publishedYear?: number | null;
  coverUrl?: string | null;
  format: string;
  subjects: string[];
  shop: Shop;
  shelfLocation: string;
  condition: BookCondition;
  pricePence: number;
  valuationConfidence: "high" | "medium" | "low";
  valuationReasons: string[];
  scannedAt: string;
};

export type BookMetadata = {
  isbn13: string;
  title: string;
  author: string;
  publisher?: string;
  publishedYear?: number;
  coverUrl?: string;
  subjects: string[];
  format: string;
};

export type Valuation = {
  pricePence: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  manualReview: boolean;
};
