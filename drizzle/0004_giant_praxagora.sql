ALTER TABLE "staff_users" ALTER COLUMN "shop_id" DROP NOT NULL;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "app_state"
    WHERE "key" = 'shop-reset-2026-07-25-v1'
  ) THEN
    DELETE FROM "audit_events";
    DELETE FROM "staff_sessions";
    DELETE FROM "shop_invites";
    DELETE FROM "inventory";
    DELETE FROM "books";
    DELETE FROM "staff_users" WHERE "role" <> 'admin';
    UPDATE "staff_users"
      SET "shop_id" = NULL, "updated_at" = now()
      WHERE "role" = 'admin';
    DELETE FROM "shops";
    INSERT INTO "app_state" ("key", "value")
    VALUES ('shop-reset-2026-07-25-v1', 'complete');
  END IF;
END
$$;
