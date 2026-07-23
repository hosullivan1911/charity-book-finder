# Goodfind — charity book finder

Goodfind is a mobile-first prototype with two connected experiences:

1. **Book discovery:** customers search participating charity shops by title,
   author or ISBN, see the current price, and get an exact shelf location.
2. **Shop intake:** a volunteer scans an ISBN, records condition and shelf
   location, receives a transparent charity-shop valuation, and adds the copy
   to live inventory.

## What works

- Responsive public catalogue with shop and book search
- Mobile camera barcode scanning using `@zxing/browser`
- Manual ISBN entry as a universal fallback
- Open Library metadata and cover lookup
- Rule-based GBP valuation with confidence and explanation
- Manual-review flag for potentially collectible books
- D1 schema for shops, canonical books and individual inventory copies
- API routes for catalogue reads, shop lists and stock intake
- Demo data fallback so the interface remains explorable before a database is
  connected

## Valuation model

The MVP recommends normal charity-shop shelf prices, not collector-market
values. It begins with a £2.50 paperback or £3.50 hardback baseline and then
applies small, capped adjustments for:

- condition;
- publication recency;
- broad subject demand; and
- accessible children's pricing.

Prices are rounded to 50p and constrained to £1–£8. Books published before
1970 or identified as signed, first, limited or antiquarian editions are held
for manual review. This protects shops from confidently underpricing the cases
where automated commodity pricing is least appropriate.

For a later production model, replace or calibrate these weights using each
charity's actual sell-through history, local shop demand and days-on-shelf.

## Local development

```bash
npm install
npm run dev
```

Then open the public catalogue at `/` or the volunteer intake flow at `/staff`.

## Architecture

- Vinext / React / TypeScript
- Cloudflare D1 via Drizzle ORM
- Open Library ISBN metadata API
- ZXing browser barcode scanner

Database tables are defined in `db/schema.ts`; generated migrations live in
`drizzle/`.

## Production gaps to close

This repository is an MVP, not yet a multi-charity production service. Before a
public launch:

- add external staff authentication and per-shop authorization;
- add a reservation / sold workflow and stale-stock expiry;
- allow managers to override prices and audit those decisions;
- replace prototype shop records with verified partner data;
- add privacy, accessibility and operational policies;
- add stock analytics and valuation calibration from real sell-through data;
- confirm Open Library usage and add a secondary metadata source for misses.

The key product assumption to test first is operational: can volunteers scan
and locate books quickly enough that the inventory stays trustworthy?
