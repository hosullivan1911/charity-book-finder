import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;

function createDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Connect a Neon database in Vercel or add it to .env.local.",
    );
  }

  return drizzle({
    client: neon(databaseUrl),
    schema,
  });
}

export async function getDb() {
  database ??= createDatabase();
  return database;
}
