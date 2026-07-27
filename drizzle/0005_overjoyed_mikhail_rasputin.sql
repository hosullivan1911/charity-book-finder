ALTER TABLE "inventory" ADD COLUMN "removed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "inventory"
SET
  "removed_at" = COALESCE("sold_at", "updated_at"),
  "sold_at" = NULL
WHERE "status" = 'removed' AND "sold_at" IS NOT NULL;
