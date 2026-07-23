# Goodfind — charity book finder

Goodfind is a mobile-first charity-shop book catalogue with two experiences:

1. Customers search participating shops by title, author or ISBN and see the
   price and exact shelf location.
2. Volunteers scan a book's ISBN, record its condition and location, receive a
   suggested charity-shop price, and add it to live stock.

The application is a standard Next.js project designed for Vercel. It uses
Neon Postgres through Drizzle ORM and falls back to demo stock until a database
is connected.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import
   `hosullivan1911/charity-book-finder`.
2. Leave the detected framework as **Next.js** and deploy.
3. In the Vercel project, open **Storage → Create Database**, choose Neon, and
   connect it to the project. Confirm that Vercel has added `DATABASE_URL` to
   the project's environments.
4. Apply the database migration once:

   ```bash
   git clone https://github.com/hosullivan1911/charity-book-finder.git
   cd charity-book-finder
   npm install
   npx vercel link
   npx vercel env pull .env.local
   npm run db:migrate
   ```

5. Redeploy from Vercel. Future pushes to the connected GitHub branch deploy
   automatically.

The customer catalogue is at `/`. The volunteer scanner is at `/staff`.
Vercel serves the site over HTTPS, which is required for camera access. On the
first scan, allow camera permission in the phone browser.

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

## Valuation model

The MVP recommends normal charity-shop shelf prices, not collector-market
values. It starts with a £2.50 paperback or £3.50 hardback baseline, adjusts for
condition, recency and subject demand, rounds to 50p, and caps prices at £1–£8.
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
