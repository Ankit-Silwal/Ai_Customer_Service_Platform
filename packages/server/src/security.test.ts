import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordHash,
  verifyPassword,
  token,
  hash,
  signScope,
  readScope,
} from "./security.ts";
import { validateFile, chunkPages } from "./documents.ts";
test("passwords are salted and verified without storing plaintext", async () => {
  const first = await passwordHash("a-secure-test-password");
  const second = await passwordHash("a-secure-test-password");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("a-secure-test-password", first), true);
  assert.equal(await verifyPassword("wrong", first), false);
});
test("opaque tokens are unique and stored as irreversible digests", () => {
  const first = token();
  assert.notEqual(first, token());
  assert.notEqual(first, hash(first));
  assert.equal(hash(first).length, 64);
});
test("service scope rejects tampering and wrong keys", () => {
  const secret = "test-secret-with-at-least-32-characters";
  const value = signScope(
    { organizationId: "tenant-a", botId: "bot-a" },
    secret,
  );
  assert.equal((readScope(value, secret) as { botId: string }).botId, "bot-a");
  assert.equal(readScope(value + "x", secret), null);
  assert.equal(readScope(value, "wrong-secret"), null);
});
test("file validation rejects disguised binary, wrong signatures and large files", () => {
  assert.throws(() =>
    validateFile("policy.pdf", "application/pdf", Buffer.from("not a PDF")),
  );
  assert.throws(() =>
    validateFile("policy.txt", "text/plain", Buffer.from([0, 1, 2])),
  );
  assert.throws(() =>
    validateFile("policy.txt", "text/plain", Buffer.alloc(6 * 1024 * 1024)),
  );
  assert.doesNotThrow(() =>
    validateFile(
      "policy.md",
      "text/markdown",
      Buffer.from("A readable company policy."),
    ),
  );
});
test("chunks preserve pages and reject scanned empty documents", () => {
  const chunks = chunkPages([
    {
      page: 3,
      text: "Returns are available within 30 days of delivery. ".repeat(50),
    },
  ]);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.page === 3 && c.text.length <= 1200));
  assert.throws(() => chunkPages([{ page: 1, text: "" }]), /OCR/);
});
