# Giveleaf — find books in charity shops

Giveleaf is a mobile-first charity-shop book finder with two connected
experiences:

1. Customers enter an Australian address and travel distance, then search
   nearby participating shops by title, author or ISBN.
2. Volunteers scan donated books into stock, search their current inventory,
   and remove any book that is no longer available.

The application is a standard Next.js project designed to run as two Vercel
sites from one repository. The public catalogue and protected shop scanner use
the same Neon Postgres database, so stock changes appear publicly within 15
seconds.

Giveleaf does not set or display book prices. Each participating charity shop
remains responsible for its own pricing.

## Mission

Giveleaf exists to make every donated book easier to find, helping more people
access affordable reading, support local charities and keep good books in
circulation.

## Customer discovery

Customers can:

- enter an Australian address, suburb or postcode and choose a 5, 10, 25, 50
  or 100 km search radius;
- see only participating shops and live inventory inside that area;
- search by title, author, ISBN or subject;
- receive intelligent alternatives when the exact book is unavailable.

The recommendation model looks up the requested book's author, subjects and
publication profile through Open Library, then ranks only books that are
currently in stock inside the selected area. It never recommends an invented or
unavailable title. If metadata enrichment is temporarily offline, Giveleaf
falls back to query-token similarity.

Address searches are sent to the OpenStreetMap Nominatim geocoder and are not
stored by Giveleaf.

## Shop workflow

After signing in, volunteers have two options:

- **Stock in** — scan the ISBN. The book and its cover are identified and
  immediately added to live inventory.
- **Inventory** — search by title, author or ISBN and remove any item that is no
  longer available.

If a shop has multiple copies of the same ISBN, each is shown as a separate
inventory item and can be removed independently.

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
DATABASE_URL=<the shared Neon connection string>
```

The catalogue project only needs:

```text
SITE_MODE=catalogue
DATABASE_URL=<the same Neon connection string>
```

Giveleaf creates its small trial schema automatically on the first request.
Migrations can also be applied manually from a linked local checkout:

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
allows staff to create a username and password, choose a participating shop,
and sign in. Passwords are stored only as salted hashes. Each account is
permanently linked to its selected shop, and its session is stored securely in
Neon. Vercel serves both sites over HTTPS, which is required for camera access.

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
change. Each shop also needs `latitude` and `longitude` so distance filtering
works. Vercel will redeploy the change automatically. Keep every `id` and
`slug` unique; the stock API synchronises the configured shops into Neon. On
the first request, Giveleaf also creates its small trial schema automatically,
so a newly connected Neon database is ready for the first real scan without
loading sample inventory.

## Architecture

- Next.js, React and TypeScript
- Vercel hosting and server functions
- Neon Postgres via Drizzle ORM
- Open Library ISBN metadata
- Open Library-enriched content recommendation model
- OpenStreetMap Nominatim address geocoding
- ZXing browser barcode scanner with rear-camera preference

Database tables are defined in `db/schema.ts`; migrations live in `drizzle/`.
The original pricing columns remain unused in the first database schema solely
to avoid requiring an immediate production migration.

## Before a public launch

Add shop invitation or manager approval codes, login rate limiting, password
recovery, verified partner records, privacy and accessibility policies, stock
analytics, fuller audit history, and a secondary metadata provider.
