# Spine — live charity-shop book inventory

Spine is a mobile-first charity-shop book catalogue with two experiences:

1. Customers search participating shops by title, author or ISBN and see the
   price and exact shelf location.
2. Volunteers scan a book's ISBN, record its condition and location, receive a
   suggested charity-shop price, and add it to live stock.

The application is a standard Next.js project designed to run as two Vercel
sites from one repository. The public catalogue and protected shop scanner use
the same Neon Postgres database, so newly scanned stock appears publicly within
15 seconds.

## Deploy the two Vercel sites

Import `hosullivan1911/charity-book-finder` into Vercel twice. Leave the
framework and root-directory settings at their detected Next.js defaults.

| Vercel project | Purpose | Required `SITE_MODE` |
| --- | --- | --- |
| Spine catalogue | Public book search | `catalogue` |
| Spine intake | Volunteer scanning | `scanner` |

In the catalogue project, open **Storage → Create Database**, choose Neon,
select **Sydney, Australia (Southeast)**, and connect it. Connect that same Neon
database to the scanner project so both projects receive the same
`DATABASE_URL`.

Add these server environment variables to the scanner project:

```text
SITE_MODE=scanner
SHOP_LOGIN_EMAIL=your-volunteer-email
SHOP_LOGIN_PASSWORD=your-strong-password
SHOP_SESSION_SECRET=a-random-secret-of-at-least-32-characters
SHOP_SLUG=harrys-test-shop
```

The catalogue project only needs:

```text
SITE_MODE=catalogue
DATABASE_URL=<the same Neon connection string>
```

Apply the database migration once from either linked project:

```bash
git clone https://github.com/hosullivan1911/charity-book-finder.git
cd charity-book-finder
npm install
npx vercel link
npx vercel env pull .env.local
npm run db:migrate
```

Redeploy both projects after adding their environment variables. Future pushes
to `main` deploy both sites automatically.

The catalogue site opens at `/`. The scanner site redirects `/` to `/staff` and
requires the configured login. Vercel serves both over HTTPS, which is required
for camera access.

## Run locally

```bash
git clone https://github.com/hosullivan1911/charity-book-finder.git
cd charity-book-finder
cp .env.example .env.local
npm install
npm run dev
```

Replace the example `DATABASE_URL` with a real Neon connection string. Without
one, the public catalogue remains usable with demo data and scans are valued
without being permanently stored.

## Useful commands

```bash
npm run dev          # start the local app
npm run lint         # run ESLint
npm test             # lint and create a production build
npm run db:generate  # generate a migration after a schema change
npm run db:migrate   # apply pending migrations
npm run db:studio    # inspect the connected database
```

## Edit participating shops

The master list is deliberately isolated in [`config/shops.ts`](config/shops.ts).
Edit that one file in GitHub to add, remove or rename shops, then commit the
change. Vercel will redeploy it automatically. Keep every `id` and `slug`
unique; the intake API synchronises the configured shops into Neon.

## Valuation model

The MVP recommends normal charity-shop shelf prices, not collector-market
values. It starts with an A$2.50 paperback or A$3.50 hardback baseline, adjusts
for condition, recency and subject demand, rounds to 50 cents, and caps prices
at A$1–A$8.
Potentially collectible books are flagged for a manual check.

## Architecture

- Next.js, React and TypeScript
- Vercel hosting and server functions
- Neon Postgres via Drizzle ORM
- Open Library ISBN metadata
- ZXing browser barcode scanner with rear-camera preference

Database tables are defined in `db/schema.ts`; migrations live in `drizzle/`.

## Before a public launch

Add staff authentication and per-shop permissions, manager price overrides,
sold/reserved workflows, verified partner records, privacy and accessibility
policies, stock analytics, and a secondary metadata provider.
