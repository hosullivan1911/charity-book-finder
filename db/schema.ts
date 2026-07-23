import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const shops = sqliteTable("shops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  postcode: text("postcode").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  openingHours: text("opening_hours").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const books = sqliteTable(
  "books",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    isbn13: text("isbn13").notNull().unique(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    publisher: text("publisher"),
    publishedYear: integer("published_year"),
    coverUrl: text("cover_url"),
    subjects: text("subjects").notNull().default("[]"),
    format: text("format").notNull().default("Paperback"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("books_title_idx").on(table.title), index("books_author_idx").on(table.author)],
);

export const inventory = sqliteTable(
  "inventory",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bookId: integer("book_id")
      .notNull()
      .references(() => books.id),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id),
    shelfLocation: text("shelf_location").notNull(),
    condition: text("condition").notNull().default("good"),
    pricePence: integer("price_pence").notNull(),
    valuationConfidence: text("valuation_confidence").notNull(),
    valuationReasons: text("valuation_reasons").notNull().default("[]"),
    status: text("status").notNull().default("available"),
    scannedBy: text("scanned_by"),
    scannedAt: text("scanned_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    soldAt: text("sold_at"),
  },
  (table) => [
    index("inventory_shop_status_idx").on(table.shopId, table.status),
    index("inventory_book_status_idx").on(table.bookId, table.status),
  ],
);
