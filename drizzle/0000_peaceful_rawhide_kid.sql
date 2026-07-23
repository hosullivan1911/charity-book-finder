CREATE TABLE "books" (
	"id" serial PRIMARY KEY NOT NULL,
	"isbn13" text NOT NULL,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"publisher" text,
	"published_year" integer,
	"cover_url" text,
	"subjects" text DEFAULT '[]' NOT NULL,
	"format" text DEFAULT 'Paperback' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_isbn13_unique" UNIQUE("isbn13")
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_id" integer NOT NULL,
	"shop_id" integer NOT NULL,
	"shelf_location" text NOT NULL,
	"condition" text DEFAULT 'good' NOT NULL,
	"price_pence" integer NOT NULL,
	"valuation_confidence" text NOT NULL,
	"valuation_reasons" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"scanned_by" text,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sold_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text NOT NULL,
	"postcode" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"opening_hours" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_title_idx" ON "books" USING btree ("title");--> statement-breakpoint
CREATE INDEX "books_author_idx" ON "books" USING btree ("author");--> statement-breakpoint
CREATE INDEX "inventory_shop_status_idx" ON "inventory" USING btree ("shop_id","status");--> statement-breakpoint
CREATE INDEX "inventory_book_status_idx" ON "inventory" USING btree ("book_id","status");--> statement-breakpoint
INSERT INTO "shops" ("slug", "name", "address", "postcode", "opening_hours")
VALUES
	('harrys-test-shop', 'Harry''s Test Shop', 'Perth, Western Australia', '6000', 'Trial shop · By arrangement')
ON CONFLICT ("slug") DO NOTHING;
