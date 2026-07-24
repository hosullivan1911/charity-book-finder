export type BookCondition = "like_new" | "good" | "fair";

export type Shop = {
  id: number;
  slug: string;
  name: string;
  address: string;
  postcode: string;
  openingHours: string;
  latitude?: number | null;
  longitude?: number | null;
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

export type BookRecommendation = {
  inventoryId: number;
  reason: string;
  score: number;
};
