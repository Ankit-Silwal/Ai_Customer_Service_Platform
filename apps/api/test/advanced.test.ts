import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { Bot, Conversation, Document, Me } from "@relay/contracts";

const apiBase = process.env.TEST_API_URL ?? "http://localhost:4100/api";
async function account(base = apiBase) {
  const response = await fetch(base + "/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Verification user",
      company: "Verification company",
      email: "verify-" + randomUUID() + "@example.test",
      password: "Verification-password-123",
    }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  const cookie = response.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join(";");
  async function request<T>(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    expected = 200,
  ) {
    const result = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const value: unknown = await result.json();
    assert.equal(result.status, expected, JSON.stringify(value));
    return value as T;
  }
  const me = await request<Me>("/me");
  const bot = (
    await request<Bot[]>("/organizations/" + me.organizations[0]!.id + "/bots")
  )[0]!;
  return { request, bot };
}
function pdfFixture(text: string) {
  const stream = "BT /F1 12 Tf 50 750 Td (" + text + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream",
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(content));
    content += i + 1 + " 0 obj\n" + o + "\nendobj\n";
  });
  const xref = Buffer.byteLength(content);
  content +=
    "xref\n0 6\n0000000000 65535 f \n" +
    offsets
      .slice(1)
      .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
      .join("") +
    "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" +
    xref +
    "\n%%EOF";
  return Buffer.from(content).toString("base64");
}
test(
  "real PDF extraction preserves page citations and document deletion",
  { timeout: 45000 },
  async () => {
    const { request, bot } = await account();
    const doc = await request<{ id: string }>(
      "/bots/" + bot.id + "/documents",
      {
        name: "warranty.pdf",
        type: "application/pdf",
        content: pdfFixture(
          "Northstar warranty coverage lasts exactly 24 months from purchase. Keep your receipt for warranty claims.",
        ),
      },
      "POST",
      201,
    );
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const docs = await request<Document[]>("/bots/" + bot.id + "/documents");
      const document = docs.find((d) => d.id === doc.id);
      assert.notEqual(
        document?.status,
        "failed",
        document?.error ?? "PDF failed",
      );
      if (document?.status === "ready") {
        ready = true;
        break;
      }
      await setTimeout(500);
    }
    assert.ok(ready, "PDF was indexed by the worker");
    const chat = await request<{ id: string }>(
      "/bots/" + bot.id + "/conversations",
      {},
      "POST",
      201,
    );
    const answer = await request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "How long is the warranty?", requestId: randomUUID() },
    );
    assert.ok(
      answer.messages.some(
        (m) =>
          m.role === "assistant" &&
          m.citations.some(
            (c) =>
              c.documentId === doc.id &&
              c.page === 1 &&
              c.excerpt.includes("24 months"),
          ),
      ),
    );
    await request(
      "/bots/" + bot.id + "/documents/" + doc.id,
      undefined,
      "DELETE",
    );
    assert.equal(
      (await request<Document[]>("/bots/" + bot.id + "/documents")).length,
      0,
    );
  },
);
test(
  "takeover and release discard an AI reply already in flight",
  { timeout: 30000 },
  async (t) => {
    if (!process.env.DATABASE_URL)
      throw new Error(
        "Run with node --env-file=.env.platform --import tsx --test apps/api/test/advanced.test.ts",
      );
    let deliver!: () => void;
    const gate = new Promise<void>((resolve) => {
      deliver = resolve;
    });
    let started!: () => void;
    const called = new Promise<void>((resolve) => {
      started = resolve;
    });
    const knowledge = createServer(async (_req, res) => {
      started();
      await gate;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          content: "LATE AI RESPONSE",
          citations: [],
          mode: "ai",
          tokens: 5,
        }),
      );
    });
    knowledge.listen(0, "127.0.0.1");
    await once(knowledge, "listening");
    const address = knowledge.address();
    assert.ok(address && typeof address !== "string");
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "apps/api/src/index.ts"],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        env: {
          ...process.env,
          PORT: "4110",
          KNOWLEDGE_URL: "http://127.0.0.1:" + address.port,
          NODE_ENV: "test",
        },
        stdio: "pipe",
        windowsHide: true,
      },
    );
    t.after(() => {
      deliver();
      knowledge.closeAllConnections();
      knowledge.close();
      child.kill();
    });
    const base = "http://127.0.0.1:4110/api";
    let healthy = false;
    for (let i = 0; i < 50; i++) {
      try {
        const response = await fetch(base + "/health");
        if (response.ok) {
          healthy = true;
          break;
        }
      } catch {
        /* wait for startup */
      }
      await setTimeout(100);
    }
    assert.ok(healthy, "test gateway started");
    const { request, bot } = await account(base);
    const chat = await request<{ id: string }>(
      "/bots/" + bot.id + "/conversations",
      {},
      "POST",
      201,
    );
    const pending = request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "Tell me about returns", requestId: randomUUID() },
    );
    await called;
    await request(
      "/conversations/" + chat.id + "/messages",
      { content: "A concurrent question", requestId: randomUUID() },
      "POST",
      409,
    );
    await request("/conversations/" + chat.id + "/takeover", {});
    await request("/conversations/" + chat.id + "/reply", {
      content: "A person is helping now.",
      requestId: randomUUID(),
    });
    await request("/conversations/" + chat.id + "/release", {});
    deliver();
    const result = await pending;
    assert.equal(result.mode, "ai");
    assert.ok(result.messages.some((m) => m.role === "agent"));
    assert.ok(
      result.messages.every(
        (m) =>
          m.role !== "assistant" && !m.content.includes("LATE AI RESPONSE"),
      ),
    );
  },
);
