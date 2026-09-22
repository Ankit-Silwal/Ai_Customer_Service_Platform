import { readFile } from "node:fs/promises";
import { pool, transaction } from "./db.ts";
await transaction(async (client) => {
  await client.query("SELECT pg_advisory_xact_lock(918237)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())",
  );
  const found = await client.query(
    "SELECT name FROM schema_migrations WHERE name='001_platform'",
  );
  if (!found.rowCount) {
    await client.query(
      await readFile(
        new URL("../migrations/001_platform.sql", import.meta.url),
        "utf8",
      ),
    );
    await client.query(
      "INSERT INTO schema_migrations(name) VALUES('001_platform')",
    );
  }
});
console.log("Platform migrations applied.");
await pool.end();
