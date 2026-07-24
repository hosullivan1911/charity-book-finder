import { sql } from "drizzle-orm";
import { LAUNCH_DATA_RESET_KEY } from "../config/launch";
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
      "role" text DEFAULT 'staff' NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE "staff_users"
      ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'staff' NOT NULL,
      ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
    CREATE TABLE IF NOT EXISTS "shop_invites" (
      "id" serial PRIMARY KEY NOT NULL,
      "code_hash" text NOT NULL UNIQUE,
      "shop_id" integer NOT NULL REFERENCES "shops"("id"),
      "role" text DEFAULT 'staff' NOT NULL,
      "created_by" integer REFERENCES "staff_users"("id") ON DELETE SET NULL,
      "expires_at" timestamp with time zone NOT NULL,
      "max_uses" integer DEFAULT 1 NOT NULL,
      "use_count" integer DEFAULT 0 NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
      "key" text PRIMARY KEY NOT NULL,
      "attempt_count" integer DEFAULT 0 NOT NULL,
      "window_started_at" timestamp with time zone NOT NULL,
      "blocked_until" timestamp with time zone,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "actor_user_id" integer REFERENCES "staff_users"("id") ON DELETE SET NULL,
      "actor_username" text,
      "shop_id" integer REFERENCES "shops"("id"),
      "action" text NOT NULL,
      "target_type" text NOT NULL,
      "target_id" text,
      "details" text DEFAULT '{}' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "app_state" (
      "key" text PRIMARY KEY NOT NULL,
      "value" text NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
      "sold_at" timestamp with time zone,
      "removed_by" text,
      "removal_reason" text,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    )
  `);

  await db.execute(sql`
    ALTER TABLE "inventory"
      ADD COLUMN IF NOT EXISTS "removed_by" text,
      ADD COLUMN IF NOT EXISTS "removal_reason" text,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
    CREATE INDEX IF NOT EXISTS "shop_invites_shop_idx"
    ON "shop_invites" ("shop_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "shop_invites_expiry_idx"
    ON "shop_invites" ("expires_at")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_events_shop_idx"
    ON "audit_events" ("shop_id")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "audit_events_created_idx"
    ON "audit_events" ("created_at")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inventory_shop_status_idx"
    ON "inventory" ("shop_id", "status")
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "inventory_book_status_idx"
    ON "inventory" ("book_id", "status")
  `);

  // One guarded reset clears only the prototype data requested by the owner.
  // Shop records survive, and the marker prevents the reset from ever repeating.
  await db.execute(sql.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM "app_state"
        WHERE "key" = '${LAUNCH_DATA_RESET_KEY}'
      ) THEN
        DELETE FROM "audit_events";
        DELETE FROM "staff_sessions";
        DELETE FROM "shop_invites";
        DELETE FROM "inventory";
        DELETE FROM "books";
        DELETE FROM "staff_users";
        INSERT INTO "app_state" ("key", "value")
        VALUES ('${LAUNCH_DATA_RESET_KEY}', 'complete');
      END IF;
    END
    $$;
  `));
}
