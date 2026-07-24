import { sql } from "drizzle-orm";
import type { Database } from ".";

/**
 * Neon integrations provision a database, but they do not apply this
 * repository's Drizzle migrations automatically. Keep the small trial schema
 * self-initialising so the first real scan works on a newly connected database.
 *
 * Every statement is idempotent, which also makes this safe when the catalogue
 * and scanner deployments share the same Neon database.
 */
export async function ensureDatabaseSchema(db: Database) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "shops" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" text NOT NULL UNIQUE,
      "name" text NOT NULL,
      "address" text NOT NULL,
      "postcode" text NOT NULL,
      "latitude" double precision,
      "longitude" double precision,
      "opening_hours" text NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE "shops"
      ADD COLUMN IF NOT EXISTS "latitude" double precision,
      ADD COLUMN IF NOT EXISTS "longitude" double precision,
      ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "staff_users" (
      "id" serial PRIMARY KEY NOT NULL,
      "username" text NOT NULL UNIQUE,
      "password_hash" text NOT NULL,
      "shop_id" integer NOT NULL REFERENCES "shops"("id"),
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "staff_sessions" (
      "token_hash" text PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL REFERENCES "staff_users"("id") ON DELETE CASCADE,
      "expires_at" timestamp with time zone NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "books" (
      "id" serial PRIMARY KEY NOT NULL,
      "isbn13" text NOT NULL UNIQUE,
      "title" text NOT NULL,
      "author" text NOT NULL,
      "publisher" text,
      "published_year" integer,
      "cover_url" text,
      "subjects" text DEFAULT '[]' NOT NULL,
      "format" text DEFAULT 'Paperback' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "inventory" (
      "id" serial PRIMARY KEY NOT NULL,
      "book_id" integer NOT NULL REFERENCES "books"("id"),
      "shop_id" integer NOT NULL REFERENCES "shops"("id"),
      "shelf_location" text NOT NULL,
      "condition" text DEFAULT 'good' NOT NULL,
      "price_pence" integer DEFAULT 0 NOT NULL,
      "valuation_confidence" text DEFAULT 'not_used' NOT NULL,
      "valuation_reasons" text DEFAULT '[]' NOT NULL,
      "status" text DEFAULT 'available' NOT NULL,
      "scanned_by" text,
      "scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
      "sold_at" timestamp with time zone
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "books_title_idx" ON "books" ("title")`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS "books_author_idx" ON "books" ("author")`,
  );
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "staff_users_shop_idx"
    ON "staff_users" ("shop_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "staff_sessions_user_idx"
    ON "staff_sessions" ("user_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "staff_sessions_expiry_idx"
    ON "staff_sessions" ("expires_at")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inventory_shop_status_idx"
    ON "inventory" ("shop_id", "status")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inventory_book_status_idx"
    ON "inventory" ("book_id", "status")
  `);
}
