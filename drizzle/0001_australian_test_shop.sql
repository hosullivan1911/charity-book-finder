UPDATE "shops" SET "active" = false;--> statement-breakpoint
INSERT INTO "shops" ("slug", "name", "address", "postcode", "opening_hours", "active")
VALUES (
	'harrys-test-shop',
	'Harry''s Test Shop',
	'Perth, Western Australia',
	'6000',
	'Trial shop · By arrangement',
	true
)
ON CONFLICT ("slug") DO UPDATE SET
	"name" = EXCLUDED."name",
	"address" = EXCLUDED."address",
	"postcode" = EXCLUDED."postcode",
	"opening_hours" = EXCLUDED."opening_hours",
	"active" = true;
