import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import type { Bot, Conversation, Document, Me } from "@relay/contracts";
const base = process.env.TEST_API_URL ?? "http://localhost:4100/api";
class Client {
  cookies = new Map<string, string>();
  async request<T>(
    path: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    expected = 200,
  ): Promise<T> {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: [...this.cookies].map(([k, v]) => k + "=" + v).join(";"),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const index = pair.indexOf("=");
      this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value as T;
  }
}
async function register(label: string) {
  const client = new Client();
  await client.request(
    "/auth/register",
    {
      name: label,
      company: label + " company",
      email: label + "-" + randomUUID() + "@example.test",
      password: "Integration-test-password-123",
    },
    "POST",
    201,
  );
  const me = await client.request<Me>("/me");
  const bot = (
    await client.request<Bot[]>(
      "/organizations/" + me.organizations[0]!.id + "/bots",
    )
  )[0]!;
  return { client, me, bot };
}
test(
  "tenant isolation, document ingestion, citations, public sessions, handoff and revocation",
  { timeout: 120000 },
  async () => {
    const a = await register("TenantA"),
      b = await register("TenantB");
    const outsider = new Client();
    await outsider.request(
      "/bots/" + a.bot.id + "/documents",
      undefined,
      "GET",
      401,
    );
    await b.client.request(
      "/bots/" + a.bot.id + "/documents",
      undefined,
      "GET",
      403,
    );
    await b.client.request(
      "/bots/" + a.bot.id + "/conversations",
      {},
      "POST",
      403,
    );
    await a.client.request(
      "/bots/" + a.bot.id + "/documents",
      {
        name: "fake.pdf",
        type: "application/pdf",
        content: Buffer.from("fake pdf").toString("base64"),
      },
      "POST",
      400,
    );
    const upload = {
      name: "returns.txt",
      type: "text/plain",
      content: Buffer.from(
        "Northstar returns policy. Customers can return unused products within 30 days of delivery. Refunds take 5 to 7 business days. Secret marker: blue-orchid.",
      ).toString("base64"),
    };
    const doc = await a.client.request<{ id: string }>(
      "/bots/" + a.bot.id + "/documents",
      upload,
      "POST",
      201,
    );
    const duplicate = await a.client.request<{ id: string }>(
      "/bots/" + a.bot.id + "/documents",
      upload,
    );
    assert.equal(duplicate.id, doc.id);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      const docs = await a.client.request<Document[]>(
        "/bots/" + a.bot.id + "/documents",
      );
      if (docs.some((d) => d.id === doc.id && d.status === "ready")) {
        ready = true;
        break;
      }
      await setTimeout(1000);
    }
    assert.ok(ready, "document indexed by worker");
    const chat = await a.client.request<{ id: string }>(
      "/bots/" + a.bot.id + "/conversations",
      {},
      "POST",
      201,
    );
    await b.client.request("/conversations/" + chat.id, undefined, "GET", 403);
    const requestId = randomUUID();
    const answer = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "What is the returns policy?", requestId },
    );
    assert.equal(
      answer.messages.filter((m) => m.role === "assistant").length,
      1,
    );
    assert.ok(
      answer.messages.some((m) =>
        m.citations.some((c) => c.documentId === doc.id && c.page === 1),
      ),
    );
    const repeat = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "What is the returns policy?", requestId },
    );
    assert.equal(repeat.messages.length, answer.messages.length);
    const bChat = await b.client.request<{ id: string }>(
      "/bots/" + b.bot.id + "/conversations",
      {},
      "POST",
      201,
    );
    const isolated = await b.client.request<Conversation>(
      "/conversations/" + bChat.id + "/messages",
      {
        content: "What is the blue orchid returns policy?",
        requestId: randomUUID(),
      },
    );
    assert.ok(
      isolated.messages
        .filter((m) => m.role === "assistant")
        .every(
          (m) => m.citations.length === 0 && !m.content.includes("blue-orchid"),
        ),
    );
    const waiting = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/handoff",
      {},
    );
    assert.equal(waiting.mode, "waiting");
    const held = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "Are you there?", requestId: randomUUID() },
    );
    assert.equal(held.messages.filter((m) => m.role === "assistant").length, 1);
    await a.client.request("/conversations/" + chat.id + "/takeover", {});
    const human = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/reply",
      { content: "Yes, a real teammate is here.", requestId: randomUUID() },
    );
    assert.ok(human.messages.some((m) => m.role === "agent"));
    const stillHeld = await a.client.request<Conversation>(
      "/conversations/" + chat.id + "/messages",
      { content: "Please help with my return.", requestId: randomUUID() },
    );
    assert.equal(
      stillHeld.messages.filter((m) => m.role === "assistant").length,
      1,
    );
    await a.client.request("/conversations/" + chat.id + "/release", {});
    await a.client.request("/conversations/" + chat.id + "/resolve", {});
    await a.client.request(
      "/conversations/" + chat.id + "/messages",
      { content: "Hello", requestId: randomUUID() },
      "POST",
      409,
    );
    await outsider.request(
      "/public/bots/" + a.bot.public_id,
      undefined,
      "GET",
      404,
    );
    await a.client.request(
      "/bots/" + a.bot.id,
      {
        name: a.bot.name,
        greeting: a.bot.greeting,
        color: a.bot.color,
        published: true,
      },
      "PATCH",
    );
    await outsider.request("/public/bots/" + a.bot.public_id);
    const publicChat = await outsider.request<{ id: string }>(
      "/public/bots/" + a.bot.public_id + "/conversations",
      {},
      "POST",
      201,
    );
    const otherVisitor = new Client();
    await otherVisitor.request(
      "/public/conversations/" + publicChat.id,
      undefined,
      "GET",
      404,
    );
    await outsider.request(
      "/public/conversations/" + publicChat.id + "/takeover",
      {},
      "POST",
      403,
    );
    await outsider.request(
      "/public/conversations/" + publicChat.id + "/messages",
      { content: "What is the returns policy?", requestId: randomUUID() },
    );
    await outsider.request(
      "/public/conversations/" + publicChat.id + "/handoff",
      {},
    );
    await a.client.request("/conversations/" + publicChat.id + "/takeover", {});
    await a.client.request("/conversations/" + publicChat.id + "/reply", {
      content: "A teammate joined your customer chat.",
      requestId: randomUUID(),
    });
    const seen = await outsider.request<Conversation>(
      "/public/conversations/" + publicChat.id,
    );
    assert.ok(
      seen.messages.some(
        (m) => m.content === "A teammate joined your customer chat.",
      ),
    );
    await a.client.request(
      "/organizations/" + a.me.organizations[0]!.id + "/members",
      { email: b.me.user.email, role: "VIEWER" },
    );
    await b.client.request("/bots/" + a.bot.id + "/documents");
    await b.client.request(
      "/bots/" + a.bot.id + "/documents",
      upload,
      "POST",
      403,
    );
    await b.client.request(
      "/conversations/" + chat.id + "/reply",
      { content: "Forbidden reply", requestId: randomUUID() },
      "POST",
      403,
    );
    await a.client.request(
      "/bots/" + a.bot.id + "/documents/" + doc.id,
      undefined,
      "DELETE",
    );
    assert.equal(
      (await a.client.request<Document[]>("/bots/" + a.bot.id + "/documents"))
        .length,
      0,
    );
    const empty = await a.client.request<{ id: string }>(
      "/bots/" + a.bot.id + "/conversations",
      {},
      "POST",
      201,
    );
    const afterDelete = await a.client.request<Conversation>(
      "/conversations/" + empty.id + "/messages",
      { content: "What is the returns policy?", requestId: randomUUID() },
    );
    assert.ok(afterDelete.messages.every((m) => m.citations.length === 0));
    await a.client.request("/auth/logout-all", {});
    await a.client.request("/me", undefined, "GET", 401);
  },
);
