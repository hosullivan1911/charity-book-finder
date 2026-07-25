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

# Optional fallback for editions missing from Open Library
GOOGLE_BOOKS_API_KEY=<Google Books API key>
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

The catalogue site opens at `/`. The scanner site redirects `/` to `/staff`.
After the launch reset, the project owner uses the private one-time setup code
to create the first owner account. Setup then closes permanently. Owners and
managers create time-limited, shop-specific invitations for every subsequent
staff account.

Passwords are stored only as salted scrypt hashes. Browser sessions use random
tokens in secure HTTP-only cookies while Neon stores only token hashes. Vercel
serves both sites over HTTPS, which is required for camera access.

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

The Giveleaf owner manages the live shop directory from **Dashboard → Shops**.
Enter a shop name, full Australian address, postcode and opening hours. The
server verifies and geocodes the address so the location immediately works in
customer distance searches. Shops can be edited, archived or reactivated from
the same screen. An archived shop disappears from public search, its open
invitations close and its staff are signed out.

Shops are database-backed rather than committed in source control, so dashboard
changes take effect immediately without a GitHub commit or Vercel redeploy.
Giveleaf still self-initialises its small schema on the first request to a newly
connected Neon database.

## Architecture

- Next.js, React and TypeScript
- Vercel hosting and server functions
- Neon Postgres via Drizzle ORM
- Open Library ISBN metadata
- Optional Google Books metadata fallback
- Open Library-enriched content recommendation model
- OpenStreetMap Nominatim address geocoding
- ZXing browser barcode scanner with rear-camera preference
- Invitation-only role-based staff access
- Management dashboard, launch metrics and CSV inventory export
- Database-backed authentication rate limits and audit history

Database tables are defined in `db/schema.ts`; migrations live in `drizzle/`.
The original pricing columns remain unused in the first database schema solely
to avoid requiring an immediate production migration.

## Staff roles and pilot operations

- `admin` manages every shop, account, invitation and inventory record.
- `manager` manages staff invitations and inventory for the assigned shop.
- `staff` scans books, searches current stock, undoes removals and changes their
  own password.

The management dashboard is available at `/admin`. Managers can disable
accounts, reset passwords, revoke invitations, correct metadata, restore
removed books and inspect the audit trail. Readable passwords and invitation
codes are never stored.

Before adding a real partner:

1. Create the owner using the private one-time code.
2. Issue one invitation per staff member from Management.
3. Protect the GitHub, Vercel and Neon owner accounts with MFA.
4. Test database restore and inventory export procedures.
5. Confirm the shop accepts the privacy notice, terms and scan/remove process.

The public catalogue does not reserve books, guarantee availability or set shop
prices. Manual metadata entry remains available when external ISBN services
cannot identify an edition.
