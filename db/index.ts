import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import {
  ensureDatabaseSchema,
  isDatabaseSchemaCurrent,
} from "./ensure-schema";

export type Database = ReturnType<typeof createDatabase>;

let database: Database | undefined;
let databaseReady: Promise<void> | undefined;

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
  if (!databaseReady) {
    const pending = (async () => {
      if (!(await isDatabaseSchemaCurrent(database!))) {
        await ensureDatabaseSchema(database!);
      }
    })();
    databaseReady = pending;
    try {
      await pending;
    } catch (error) {
      if (databaseReady === pending) databaseReady = undefined;
      throw error;
    }
  } else {
    await databaseReady;
  }
  return database;
}
