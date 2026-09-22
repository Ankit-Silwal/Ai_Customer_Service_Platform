import type { Response, Request } from "express";
import { z } from "zod";
import { pool, transaction, audit } from "@relay/server/db";
import { hash, signScope } from "@relay/server/security";
import { HttpError } from "@relay/server/http";
import { config } from "@relay/server/config";
import { answerSchema, messageSchema } from "@relay/contracts";
import { cookie, membership, principal, rateLimit } from "./auth.ts";

export type ChatRow = {
  id: string;
  organization_id: string;
  bot_id: string;
  mode: "ai" | "waiting" | "human" | "resolved";
  version: number;
  pending_request: string | null;
  pending_until: Date | null;
  visitor_hash: string | null;
  published: boolean;
};
export async function access(req: Request, res: Response, visitor = false) {
  const id = z.uuid().parse(req.params.id);
  const result = await pool.query(
    "SELECT c.*,b.published,o.suspended FROM conversations c JOIN bots b ON b.id=c.bot_id JOIN organizations o ON o.id=c.organization_id WHERE c.id=$1",
    [id],
  );
  const chat = result.rows[0] as (ChatRow & { suspended: boolean }) | undefined;
  if (!chat || chat.suspended)
    throw new HttpError(404, "Conversation not found.");
  if (visitor) {
    if (
      !chat.published ||
      !chat.visitor_hash ||
      hash(cookie(req, "relay_visitor_" + id)) !== chat.visitor_hash
    )
      throw new HttpError(404, "Conversation not found.");
  } else await membership(res, chat.organization_id);
  return chat;
}
export async function snapshot(chat: ChatRow) {
  const [conversation, messages] = await Promise.all([
    pool.query(
      "SELECT id,title,mode,version,updated_at FROM conversations WHERE id=$1 AND organization_id=$2",
      [chat.id, chat.organization_id],
    ),
    pool.query(
      "SELECT id,role,content,citations,created_at FROM messages WHERE conversation_id=$1 AND organization_id=$2 ORDER BY created_at,id",
      [chat.id, chat.organization_id],
    ),
  ]);
  return { ...conversation.rows[0], messages: messages.rows };
}
export async function sendMessage(
  req: Request,
  res: Response,
  visitor = false,
) {
  const chat = await access(req, res, visitor),
    input = messageSchema.parse(req.body);
  if (!visitor)
    await membership(res, chat.organization_id, ["OWNER", "ADMIN", "AGENT"]);
  await rateLimit("chat:" + chat.id, 20);
  const ticket = await transaction(async (c) => {
    const current = (
      await c.query("SELECT * FROM conversations WHERE id=$1 FOR UPDATE", [
        chat.id,
      ])
    ).rows[0] as ChatRow;
    const duplicate = await c.query(
      "SELECT id FROM messages WHERE conversation_id=$1 AND request_id=$2",
      [chat.id, input.requestId],
    );
    if (duplicate.rowCount) return null;
    if (current.mode === "resolved")
      throw new HttpError(
        409,
        "This conversation is resolved. Start a new chat.",
      );
    if (
      current.pending_request &&
      current.pending_until &&
      current.pending_until > new Date()
    )
      throw new HttpError(409, "Please wait for the current reply.");
    const count = await c.query(
      "SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1",
      [chat.id],
    );
    if (count.rows[0].count >= 200)
      throw new HttpError(409, "This conversation is full. Start a new chat.");
    await c.query(
      "INSERT INTO messages(conversation_id,organization_id,role,content,request_id) VALUES($1,$2,'customer',$3,$4)",
      [chat.id, chat.organization_id, input.content, input.requestId],
    );
    await c.query(
      "UPDATE conversations SET title=CASE WHEN title='New conversation' THEN $2 ELSE title END,updated_at=now(),pending_request=$3,pending_until=now()+interval '2 minutes' WHERE id=$1",
      [
        chat.id,
        input.content.slice(0, 65),
        current.mode === "ai" ? input.requestId : null,
      ],
    );
    return current.mode === "ai" ? { version: current.version } : null;
  });
  if (ticket) {
    let result: z.infer<typeof answerSchema>;
    try {
      const response = await fetch(config.KNOWLEDGE_URL + "/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-service-scope": signScope(
            { organizationId: chat.organization_id, botId: chat.bot_id },
            config.INTERNAL_SECRET,
          ),
        },
        body: JSON.stringify({ question: input.content }),
        signal: AbortSignal.timeout(100_000),
      });
      if (!response.ok) throw new Error("Knowledge service unavailable");
      result = answerSchema.parse(await response.json());
    } catch {
      result = {
        content:
          "I am having trouble checking the knowledge base right now. Please try again or request a person to help.",
        citations: [],
        mode: "fallback",
        tokens: 0,
      };
    }
    await transaction(async (c) => {
      const current = (
        await c.query("SELECT * FROM conversations WHERE id=$1 FOR UPDATE", [
          chat.id,
        ])
      ).rows[0] as ChatRow;
      // Version fencing prevents late AI output after takeover, handoff, resolution, or release.
      if (
        current.mode === "ai" &&
        current.version === ticket.version &&
        current.pending_request === input.requestId
      ) {
        await c.query(
          "INSERT INTO messages(conversation_id,organization_id,role,content,citations,request_id) VALUES($1,$2,'assistant',$3,$4,$5) ON CONFLICT DO NOTHING",
          [
            chat.id,
            chat.organization_id,
            result.content,
            JSON.stringify(result.citations),
            input.requestId,
          ],
        );
        await c.query(
          "INSERT INTO usage_events(organization_id,conversation_id,tokens,mode) VALUES($1,$2,$3,$4)",
          [chat.organization_id, chat.id, result.tokens, result.mode],
        );
        await c.query(
          "UPDATE conversations SET pending_request=NULL,pending_until=NULL,updated_at=now() WHERE id=$1",
          [chat.id],
        );
      }
    });
  }
  res.json(await snapshot(chat));
}
export async function transition(req: Request, res: Response, visitor = false) {
  const chat = await access(req, res, visitor);
  const action = z
    .enum(["handoff", "takeover", "release", "resolve"])
    .parse(req.params.action);
  if (visitor && action !== "handoff")
    throw new HttpError(403, "Permission denied.");
  if (!visitor)
    await membership(res, chat.organization_id, ["OWNER", "ADMIN", "AGENT"]);
  const actor = visitor ? null : principal(res).id;
  await transaction(async (c) => {
    const current = (
      await c.query("SELECT mode FROM conversations WHERE id=$1 FOR UPDATE", [
        chat.id,
      ])
    ).rows[0] as { mode: string };
    if (action === "handoff" && ["waiting", "human"].includes(current.mode))
      return;
    const allowed: Record<string, string[]> = {
      handoff: ["ai"],
      takeover: ["ai", "waiting", "human"],
      release: ["human", "waiting"],
      resolve: ["ai", "waiting", "human"],
    };
    if (!allowed[action]!.includes(current.mode))
      throw new HttpError(
        409,
        "This conversation has already changed. Please refresh.",
      );
    const mode = {
      handoff: "waiting",
      takeover: "human",
      release: "ai",
      resolve: "resolved",
    }[action];
    const text = {
      handoff: "A person has been requested. Automated replies are paused.",
      takeover: "A support agent joined the conversation.",
      release: "The AI assistant is back. Ask your next question.",
      resolve: "This conversation has been resolved.",
    }[action];
    await c.query(
      "UPDATE conversations SET mode=$2,version=version+1,pending_request=NULL,pending_until=NULL,agent_id=$3,updated_at=now() WHERE id=$1",
      [chat.id, mode, action === "takeover" ? actor : null],
    );
    await c.query(
      "INSERT INTO messages(conversation_id,organization_id,role,content) VALUES($1,$2,'system',$3)",
      [chat.id, chat.organization_id, text],
    );
    await audit(
      chat.organization_id,
      actor,
      "conversation." + action,
      chat.id,
      c,
    );
  });
  res.json(await snapshot(chat));
}
export async function agentReply(req: Request, res: Response) {
  const chat = await access(req, res),
    input = messageSchema.parse(req.body);
  await membership(res, chat.organization_id, ["OWNER", "ADMIN", "AGENT"]);
  await transaction(async (c) => {
    const current = (
      await c.query(
        "SELECT mode,agent_id FROM conversations WHERE id=$1 FOR UPDATE",
        [chat.id],
      )
    ).rows[0] as { mode: string; agent_id: string | null };
    if (current.mode !== "human" || current.agent_id !== principal(res).id)
      throw new HttpError(409, "Join this conversation before replying.");
    await c.query(
      "INSERT INTO messages(conversation_id,organization_id,role,content,request_id) VALUES($1,$2,'agent',$3,$4) ON CONFLICT DO NOTHING",
      [chat.id, chat.organization_id, input.content, input.requestId],
    );
    await c.query("UPDATE conversations SET updated_at=now() WHERE id=$1", [
      chat.id,
    ]);
  });
  res.json(await snapshot(chat));
}
