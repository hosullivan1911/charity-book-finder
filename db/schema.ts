import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow();

export const shops = pgTable("shops", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  postcode: text("postcode").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  openingHours: text("opening_hours").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const books = pgTable(
  "books",
  {
    id: serial("id").primaryKey(),
    isbn13: text("isbn13").notNull().unique(),
    title: text("title").notNull(),
    author: text("author").notNull(),
    publisher: text("publisher"),
    publishedYear: integer("published_year"),
    coverUrl: text("cover_url"),
    subjects: text("subjects").notNull().default("[]"),
    format: text("format").notNull().default("Paperback"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("books_title_idx").on(table.title), index("books_author_idx").on(table.author)],
);

export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
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
    scannedAt: timestamp("scanned_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    soldAt: timestamp("sold_at", { mode: "string", withTimezone: true }),
  },
  (table) => [
    index("inventory_shop_status_idx").on(table.shopId, table.status),
    index("inventory_book_status_idx").on(table.bookId, table.status),
  ],
);
