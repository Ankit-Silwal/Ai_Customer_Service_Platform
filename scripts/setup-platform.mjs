import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { pathToFileURL } from "node:url";

const missing = (value) =>
  !value?.trim() || /^(replace-with-|change-me|your-)/i.test(value);

export function setupPlatform({
  envPath = new URL("../.env.platform", import.meta.url),
  examplePath = new URL("../.env.platform.example", import.meta.url),
} = {}) {
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const values = parseEnv(existing);
  const defaults = parseEnv(readFileSync(examplePath, "utf8"));
  const updates = new Map();
  let databasePassword = values.RELAY_DB_PASSWORD;
  if (missing(databasePassword)) {
    // Recover existing credentials before generating one for a persistent DB.
    databasePassword = missing(values.DATABASE_URL)
      ? randomBytes(24).toString("hex")
      : decodeURIComponent(new URL(values.DATABASE_URL).password);
    if (missing(databasePassword))
      databasePassword = randomBytes(24).toString("hex");
  }
  const generated = {
    RELAY_DB_PASSWORD: databasePassword,
    DATABASE_URL: `postgresql://relay:${encodeURIComponent(databasePassword)}@localhost:5440/relay`,
    INTERNAL_SECRET: randomBytes(32).toString("hex"),
    S3_SECRET_KEY: randomBytes(24).toString("hex"),
  };
  for (const [key, fallback] of Object.entries(defaults)) {
    if (missing(values[key])) {
      const value = generated[key] ?? fallback;
      if (values[key] !== value) updates.set(key, value);
    }
  }
  if (!updates.size && existing) return false;

  // Preserve comments, custom settings, and configured credentials.
  const lines = (existing || readFileSync(examplePath, "utf8"))
    .trimEnd()
    .split(/\r?\n/)
    .map((line) => {
      const key = line.match(
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
      )?.[1];
      if (!updates.has(key)) return line;
      const value = updates.get(key);
      updates.delete(key);
      return `${key}=${value}`;
    });
  for (const [key, value] of updates) lines.push(`${key}=${value}`);
  writeFileSync(envPath, lines.join("\n") + "\n", { mode: 0o600 });
  return true;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const changed = setupPlatform();
  console.log(
    changed
      ? "Completed .env.platform with missing settings and random local credentials. Existing configured values preserved."
      : "Existing .env.platform is complete and was preserved.",
  );
  console.log(
    "AI_API_KEY is optional; without it, chat returns source previews.",
  );
}
