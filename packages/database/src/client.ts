import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { migrate as migratePg } from "./migrate.js";
import { schema } from "./schema.js";
import { INIT_SQL } from "./sql.js";

type PgDb = ReturnType<typeof drizzlePg<typeof schema>>;
type LiteDb = ReturnType<typeof drizzlePglite<typeof schema>>;
export type Database = PgDb | LiteDb;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

function isPglite(url: string): boolean {
  return url.startsWith("pglite:") || url.startsWith("file:");
}

function pglitePath(url: string): string {
  const raw = url.replace(/^pglite:/, "").replace(/^file:/, "");
  return path.resolve(raw || "./data/degenlab");
}

export async function openDatabase(databaseUrl: string): Promise<Database> {
  if (isPglite(databaseUrl)) {
    const dir = pglitePath(databaseUrl);
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await client.waitReady;
    await client.exec(INIT_SQL);
    return drizzlePglite(client, { schema });
  }

  await migratePg(databaseUrl);
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzlePg(client, { schema });
}

/** @deprecated use openDatabase */
export function createDb(databaseUrl: string): PgDb {
  const client = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzlePg(client, { schema });
}
