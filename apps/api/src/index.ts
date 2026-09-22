import { z } from "zod";
import { baseApp, errors, HttpError } from "@relay/server/http";
import { config } from "@relay/server/config";
import { pool, transaction, audit } from "@relay/server/db";
import {
  token,
  hash,
  passwordHash,
  verifyPassword,
  signScope,
} from "@relay/server/security";
import {
  registerSchema,
  loginSchema,
  botSchema,
  memberSchema,
} from "@relay/contracts";
import {
  authenticated,
  principal,
  membership,
  botAccess,
  cookie,
  cookieOptions,
  rateLimit,
} from "./auth.ts";
import {
  access,
  snapshot,
  sendMessage,
  transition,
  agentReply,
} from "./conversations.ts";
export const app = baseApp();
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
app.use("/api", async (req, _res, next) => {
  await rateLimit("ip:" + hash(req.ip ?? "unknown"), 300);
  next();
});
app.post("/api/auth/register", async (req, res) => {
  const input = registerSchema.parse(req.body);
  await rateLimit("register:" + hash(req.ip ?? "unknown"), 5, 3600);
  const password = await passwordHash(input.password),
    session = token();
  try {
    await transaction(async (c) => {
      const user = (
        await c.query(
          "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id",
          [input.name, input.email, password],
        )
      ).rows[0] as { id: string };
      const org = (
        await c.query(
          "INSERT INTO organizations(name) VALUES($1) RETURNING id",
          [input.company],
        )
      ).rows[0] as { id: string };
      await c.query("INSERT INTO memberships VALUES($1,$2,'OWNER')", [
        org.id,
        user.id,
      ]);
      await c.query("INSERT INTO bots(organization_id,name) VALUES($1,$2)", [
        org.id,
        input.company + " Assistant",
      ]);
      await c.query(
        "INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",
        [hash(session), user.id],
      );
      await audit(org.id, user.id, "organization.created", org.id, c);
    });
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new HttpError(
        409,
        "An account already exists for this email. Please sign in.",
      );
    throw error;
  }
  res
    .cookie("relay_session", session, cookieOptions)
    .status(201)
    .json({ ok: true });
});
app.post("/api/auth/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  await rateLimit("login:" + hash(input.email), 10, 600);
  const user = (
    await pool.query(
      "SELECT id,password_hash,suspended FROM users WHERE email=$1",
      [input.email],
    )
  ).rows[0] as
    { id: string; password_hash: string; suspended: boolean } | undefined;
  // Run scrypt for absent accounts too, reducing timing-based email enumeration.
  const valid = await verifyPassword(
    input.password,
    user?.password_hash ??
      "00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!user || user.suspended || !valid)
    throw new HttpError(401, "Email or password is incorrect.");
  const session = token();
  await pool.query(
    "INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",
    [hash(session), user.id],
  );
  res.cookie("relay_session", session, cookieOptions).json({ ok: true });
});
app.get("/api/public/bots/:id", async (req, res) => {
  const bot = (
    await pool.query(
      "SELECT b.name,b.greeting,b.color,b.public_id FROM bots b JOIN organizations o ON o.id=b.organization_id WHERE b.public_id=$1 AND b.published AND NOT o.suspended",
      [z.uuid().parse(req.params.id)],
    )
  ).rows[0];
  if (!bot) throw new HttpError(404, "This chatbot is not available.");
  res.json(bot);
});
app.post("/api/public/bots/:id/conversations", async (req, res) => {
  await rateLimit("visitor:" + hash(req.ip ?? "unknown"), 20, 3600);
  const bot = (
    await pool.query(
      "SELECT b.id,b.organization_id FROM bots b JOIN organizations o ON o.id=b.organization_id WHERE b.public_id=$1 AND b.published AND NOT o.suspended",
      [z.uuid().parse(req.params.id)],
    )
  ).rows[0] as { id: string; organization_id: string } | undefined;
  if (!bot) throw new HttpError(404, "This chatbot is not available.");
  const visitor = token();
  const chat = (
    await pool.query(
      "INSERT INTO conversations(organization_id,bot_id,visitor_hash) VALUES($1,$2,$3) RETURNING id",
      [bot.organization_id, bot.id, hash(visitor)],
    )
  ).rows[0] as { id: string };
  res
    .cookie("relay_visitor_" + chat.id, visitor, {
      ...cookieOptions,
      path: "/api/public/conversations/" + chat.id,
    })
    .status(201)
    .json(chat);
});
app.get("/api/public/conversations/:id", async (req, res) =>
  res.json(await snapshot(await access(req, res, true))),
);
app.post("/api/public/conversations/:id/messages", (req, res) =>
  sendMessage(req, res, true),
);
app.post("/api/public/conversations/:id/:action", (req, res) =>
  transition(req, res, true),
);
app.use("/api", authenticated);
app.get("/api/me", async (_req, res) => {
  const user = principal(res);
  const organizations = (
    await pool.query(
      "SELECT o.id,o.name,m.role FROM organizations o JOIN memberships m ON m.organization_id=o.id WHERE m.user_id=$1 AND NOT o.suspended ORDER BY o.name",
      [user.id],
    )
  ).rows;
  res.json({ user, organizations, aiEnabled: Boolean(config.AI_API_KEY) });
});
app.post("/api/auth/logout", async (req, res) => {
  await pool.query("DELETE FROM sessions WHERE token_hash=$1", [
    hash(cookie(req, "relay_session")),
  ]);
  res.clearCookie("relay_session", cookieOptions).json({ ok: true });
});
app.post("/api/auth/logout-all", async (_req, res) => {
  await pool.query("DELETE FROM sessions WHERE user_id=$1", [
    principal(res).id,
  ]);
  res.clearCookie("relay_session", cookieOptions).json({ ok: true });
});
app.get("/api/organizations/:id/bots", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await membership(res, id);
  res.json(
    (
      await pool.query(
        "SELECT * FROM bots WHERE organization_id=$1 ORDER BY name",
        [id],
      )
    ).rows,
  );
});
app.post("/api/organizations/:id/bots", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    input = botSchema.parse(req.body);
  await membership(res, id, ["OWNER", "ADMIN"]);
  const result = await transaction(async (c) => {
    const bot = (
      await c.query(
        "INSERT INTO bots(organization_id,name,greeting,color,published) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [id, input.name, input.greeting, input.color, input.published],
      )
    ).rows[0] as { id: string };
    await audit(id, principal(res).id, "bot.created", bot.id, c);
    return bot;
  });
  res.status(201).json(result);
});
app.patch("/api/bots/:id", async (req, res) => {
  const bot = await botAccess(res, req.params.id as string, ["OWNER", "ADMIN"]),
    input = botSchema.parse(req.body);
  const result = await transaction(async (c) => {
    const updated = await c.query(
      "UPDATE bots SET name=$2,greeting=$3,color=$4,published=$5 WHERE id=$1 RETURNING *",
      [bot.id, input.name, input.greeting, input.color, input.published],
    );
    await audit(
      bot.organization_id,
      principal(res).id,
      "bot.updated",
      bot.id,
      c,
    );
    return updated.rows[0];
  });
  res.json(result);
});
app.get("/api/organizations/:id/members", async (req, res) => {
  const id = z.uuid().parse(req.params.id);
  await membership(res, id, ["OWNER", "ADMIN"]);
  res.json(
    (
      await pool.query(
        "SELECT u.id,u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1",
        [id],
      )
    ).rows,
  );
});
app.post("/api/organizations/:id/members", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    input = memberSchema.parse(req.body);
  await membership(res, id, ["OWNER"]);
  await transaction(async (c) => {
    const user = (
      await c.query("SELECT id FROM users WHERE email=$1 AND NOT suspended", [
        input.email,
      ])
    ).rows[0] as { id: string } | undefined;
    if (!user)
      throw new HttpError(
        404,
        "Ask your teammate to create an account first, then add their email here.",
      );
    const result = await c.query(
      "INSERT INTO memberships VALUES($1,$2,$3) ON CONFLICT(organization_id,user_id) DO UPDATE SET role=EXCLUDED.role WHERE memberships.role<>'OWNER' RETURNING user_id",
      [id, user.id, input.role],
    );
    if (!result.rowCount)
      throw new HttpError(409, "The owner role cannot be changed here.");
    await audit(id, principal(res).id, "membership.updated", user.id, c);
  });
  res.json({ ok: true });
});
app.delete("/api/organizations/:id/members/:userId", async (req, res) => {
  const id = z.uuid().parse(req.params.id),
    userId = z.uuid().parse(req.params.userId);
  await membership(res, id, ["OWNER"]);
  await transaction(async (c) => {
    const result = await c.query(
      "DELETE FROM memberships WHERE organization_id=$1 AND user_id=$2 AND role<>'OWNER'",
      [id, userId],
    );
    if (!result.rowCount) throw new HttpError(404, "Member not found.");
    await audit(id, principal(res).id, "membership.removed", userId, c);
  });
  res.json({ ok: true });
});
app.all(
  [
    "/api/bots/:id/documents",
    "/api/bots/:id/documents/:documentId",
    "/api/bots/:id/documents/:documentId/retry",
  ],
  async (req, res) => {
    if (!["GET", "POST", "DELETE"].includes(req.method))
      throw new HttpError(405, "Method not allowed.");
    const bot = await botAccess(
      res,
      req.params.id as string,
      req.method === "GET" ? undefined : ["OWNER", "ADMIN"],
    );
    const suffix = req.params.documentId
      ? "/" +
        z.uuid().parse(req.params.documentId) +
        (req.path.endsWith("/retry") ? "/retry" : "")
      : "";
    const response = await fetch(config.KNOWLEDGE_URL + "/documents" + suffix, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-service-scope": signScope(
          { organizationId: bot.organization_id, botId: bot.id },
          config.INTERNAL_SECRET,
        ),
      },
      body: req.method === "POST" ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    res.status(response.status).json(await response.json());
  },
);
app.get("/api/bots/:id/conversations", async (req, res) => {
  const bot = await botAccess(res, req.params.id as string);
  res.json(
    (
      await pool.query(
        "SELECT id,title,mode,version,updated_at FROM conversations WHERE organization_id=$1 AND bot_id=$2 ORDER BY updated_at DESC LIMIT 100",
        [bot.organization_id, bot.id],
      )
    ).rows,
  );
});
app.post("/api/bots/:id/conversations", async (req, res) => {
  const bot = await botAccess(res, req.params.id as string, [
    "OWNER",
    "ADMIN",
    "AGENT",
  ]);
  const chat = (
    await pool.query(
      "INSERT INTO conversations(organization_id,bot_id) VALUES($1,$2) RETURNING id",
      [bot.organization_id, bot.id],
    )
  ).rows[0];
  res.status(201).json(chat);
});
app.get("/api/conversations/:id", async (req, res) =>
  res.json(await snapshot(await access(req, res))),
);
app.post("/api/conversations/:id/messages", (req, res) =>
  sendMessage(req, res),
);
app.post("/api/conversations/:id/reply", agentReply);
app.post("/api/conversations/:id/:action", (req, res) => transition(req, res));
app.use(errors);
app.listen(config.PORT, "0.0.0.0", () =>
  console.log("Gateway listening on " + config.PORT),
);
