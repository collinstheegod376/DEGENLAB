import postgres from "postgres";
import { INIT_SQL } from "./sql.js";

export async function migrate(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    try {
      await sql.unsafe("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    } catch {
      // Managed Postgres often already has gen_random_uuid().
    }
    await sql.unsafe(INIT_SQL);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

const isCli = process.argv[1]?.replaceAll("\\", "/").includes("/migrate");
if (isCli) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  migrate(url)
    .then(() => {
      console.log("migrations applied");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
