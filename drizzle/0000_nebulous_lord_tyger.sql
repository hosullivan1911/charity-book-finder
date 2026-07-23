CREATE TABLE `books` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`isbn13` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`publisher` text,
	`published_year` integer,
	`cover_url` text,
	`subjects` text DEFAULT '[]' NOT NULL,
	`format` text DEFAULT 'Paperback' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn13_unique` ON `books` (`isbn13`);--> statement-breakpoint
CREATE INDEX `books_title_idx` ON `books` (`title`);--> statement-breakpoint
CREATE INDEX `books_author_idx` ON `books` (`author`);--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`book_id` integer NOT NULL,
	`shop_id` integer NOT NULL,
	`shelf_location` text NOT NULL,
	`condition` text DEFAULT 'good' NOT NULL,
	`price_pence` integer NOT NULL,
	`valuation_confidence` text NOT NULL,
	`valuation_reasons` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`scanned_by` text,
	`scanned_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sold_at` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `inventory_shop_status_idx` ON `inventory` (`shop_id`,`status`);--> statement-breakpoint
CREATE INDEX `inventory_book_status_idx` ON `inventory` (`book_id`,`status`);--> statement-breakpoint
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`postcode` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`opening_hours` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shops_slug_unique` ON `shops` (`slug`);
--> statement-breakpoint
INSERT INTO `shops` (`slug`, `name`, `address`, `postcode`, `latitude`, `longitude`, `opening_hours`)
VALUES
  ('oxfam-islington', 'Oxfam Books Islington', '48 Upper Street, London', 'N1 0PN', 51.5363, -0.1032, 'Open today · 10:00–18:00'),
  ('shelter-camden', 'Shelter Camden', '43 Parkway, London', 'NW1 7PN', 51.5388, -0.1451, 'Open today · 10:00–18:00'),
  ('battersea-bookshop', 'Battersea Community Books', '128 Battersea Park Road, London', 'SW11 4LY', 51.4771, -0.1501, 'Open today · 09:30–17:30');
