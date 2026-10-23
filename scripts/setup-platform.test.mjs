import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { setupPlatform } from "./setup-platform.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "relay-setup-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, ".env.platform");
}

test("new setup creates matching random credentials and is idempotent", (t) => {
  const envPath = fixture(t);
  assert.equal(setupPlatform({ envPath }), true);
  const content = readFileSync(envPath, "utf8");
  const values = parseEnv(content);
  assert.match(values.INTERNAL_SECRET, /^[a-f0-9]{64}$/);
  assert.match(values.S3_SECRET_KEY, /^[a-f0-9]{48}$/);
  assert.equal(new URL(values.DATABASE_URL).password, values.RELAY_DB_PASSWORD);
  assert.ok(!content.includes("replace-with-"));
  assert.equal(values.AI_API_KEY, "");
  assert.equal(setupPlatform({ envPath }), false);
  assert.equal(readFileSync(envPath, "utf8"), content);
});

test("partial setup repairs missing storage settings without rotating existing secrets", (t) => {
  const envPath = fixture(t);
  const secret = "existing-service-secret-that-is-long-enough";
  writeFileSync(
    envPath,
    `# Keep my settings\nINTERNAL_SECRET=${secret}\nDATABASE_URL=postgresql://relay:existing-db-password@localhost:5440/relay\nAI_API_KEY=existing-provider-key\nCUSTOM_SETTING=keep-me\nS3_SECRET_KEY=replace-with-a-random-storage-password\n`,
  );
  setupPlatform({ envPath });
  const content = readFileSync(envPath, "utf8");
  const values = parseEnv(content);
  assert.ok(content.startsWith("# Keep my settings\n"));
  assert.equal(values.INTERNAL_SECRET, secret);
  assert.equal(values.RELAY_DB_PASSWORD, "existing-db-password");
  assert.equal(values.AI_API_KEY, "existing-provider-key");
  assert.equal(values.CUSTOM_SETTING, "keep-me");
  assert.equal(values.S3_ENDPOINT, "http://localhost:9100");
  assert.equal(values.S3_BUCKET, "relay-documents");
  assert.match(values.S3_SECRET_KEY, /^[a-f0-9]{48}$/);
  assert.equal(setupPlatform({ envPath }), false);
});
