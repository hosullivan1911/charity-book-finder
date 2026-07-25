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

export const staffUsers = pgTable(
  "staff_users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    shopId: integer("shop_id")
      .references(() => shops.id),
    role: text("role").notNull().default("staff"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("staff_users_shop_idx").on(table.shopId)],
);

export const staffSessions = pgTable(
  "staff_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("staff_sessions_user_idx").on(table.userId),
    index("staff_sessions_expiry_idx").on(table.expiresAt),
  ],
);

export const shopInvites = pgTable(
  "shop_invites",
  {
    id: serial("id").primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    shopId: integer("shop_id")
      .notNull()
      .references(() => shops.id),
    role: text("role").notNull().default("staff"),
    createdBy: integer("created_by").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", {
      mode: "string",
      withTimezone: true,
    }).notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    useCount: integer("use_count").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (table) => [
    index("shop_invites_shop_idx").on(table.shopId),
    index("shop_invites_expiry_idx").on(table.expiresAt),
  ],
);

export const authRateLimits = pgTable("auth_rate_limits", {
  key: text("key").primaryKey(),
  attemptCount: integer("attempt_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", {
    mode: "string",
    withTimezone: true,
  }).notNull(),
  blockedUntil: timestamp("blocked_until", {
    mode: "string",
    withTimezone: true,
  }),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: serial("id").primaryKey(),
    actorUserId: integer("actor_user_id").references(() => staffUsers.id, {
      onDelete: "set null",
    }),
    actorUsername: text("actor_username"),
    shopId: integer("shop_id").references(() => shops.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    details: text("details").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (table) => [
    index("audit_events_shop_idx").on(table.shopId),
    index("audit_events_created_idx").on(table.createdAt),
  ],
);

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
    .notNull()
    .defaultNow(),
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
    removedBy: text("removed_by"),
    removalReason: text("removal_reason"),
    updatedAt: timestamp("updated_at", { mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("inventory_shop_status_idx").on(table.shopId, table.status),
    index("inventory_book_status_idx").on(table.bookId, table.status),
  ],
);
