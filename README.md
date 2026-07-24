# Giveleaf — find books in charity shops

Giveleaf is a mobile-first charity-shop book finder with two connected
experiences:

1. Customers search participating shops by title, author or ISBN and see the
   condition and exact shelf location.
2. Volunteers scan donated books into stock, scan sold books out, and search or
   filter their shop's current inventory.

The application is a standard Next.js project designed to run as two Vercel
sites from one repository. The public catalogue and protected shop scanner use
the same Neon Postgres database, so stock changes appear publicly within 15
seconds.

Giveleaf does not set or display book prices. Each participating charity shop
remains responsible for its own pricing.

## Shop workflow

After signing in, volunteers have three options:

- **Stock in** — select the shelf location and condition, then scan the ISBN.
  The book is identified and immediately added to live inventory.
- **Stock out** — scan the ISBN of a sold book. One available copy at that shop
  is marked as sold and disappears from both the shop inventory and public
  catalogue.
- **Inventory** — search by title, author, ISBN or shelf, filter by condition,
  and manually mark an item as sold when needed.

If a shop has multiple copies of the same ISBN, each stock-out scan removes one
copy.

## Deploy the two Vercel sites

Import `hosullivan1911/charity-book-finder` into Vercel twice. Leave the
framework and root-directory settings at their detected Next.js defaults.

| Vercel project | Purpose | Required `SITE_MODE` |
| --- | --- | --- |
| Giveleaf catalogue | Public book search | `catalogue` |
| Giveleaf for shops | Volunteer stock management | `scanner` |

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

Apply the existing database migrations once from either linked project:

```bash
git clone https://github.com/hosullivan1911/charity-book-finder.git
cd charity-book-finder
npm install
npx vercel link
npx vercel env pull .env.local
npm run db:migrate
```

No new migration is required when upgrading an existing Spine deployment to
Giveleaf.

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

Replace the example `DATABASE_URL` with a real Neon connection string.

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
unique; the stock API synchronises the configured shops into Neon.

## Architecture

- Next.js, React and TypeScript
- Vercel hosting and server functions
- Neon Postgres via Drizzle ORM
- Open Library ISBN metadata
- ZXing browser barcode scanner with rear-camera preference

Database tables are defined in `db/schema.ts`; migrations live in `drizzle/`.
The original pricing columns remain unused in the first database schema solely
to avoid requiring an immediate production migration.

## Before a public launch

Add per-volunteer accounts and permissions, verified partner records, privacy
and accessibility policies, stock analytics, audit history, and a secondary
metadata provider.
