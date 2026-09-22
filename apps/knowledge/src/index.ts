import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scopeSchema, uploadSchema, searchSchema } from "@relay/contracts";
import { baseApp, errors, HttpError } from "@relay/server/http";
import { pool, transaction, audit } from "@relay/server/db";
import { config } from "@relay/server/config";
import { readScope, hash } from "@relay/server/security";
import { putObject, deleteObject, ensureBucket } from "@relay/server/storage";
import { validateFile } from "@relay/server/documents";
import { embed, answer } from "@relay/server/ai";

const app = baseApp();
app.get("/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true });
});
app.use((req, res, next) => {
  const scope = scopeSchema.safeParse(
    readScope(req.header("x-service-scope") ?? "", config.INTERNAL_SECRET),
  );
  if (!scope.success)
    throw new HttpError(401, "Service authentication required.");
  res.locals.scope = scope.data;
  next();
});
app.get("/documents", async (_req, res) => {
  const scope = scopeSchema.parse(res.locals.scope);
  const result = await pool.query(
    "SELECT id,name,status,bytes,chunks,error,created_at FROM documents WHERE organization_id=$1 AND bot_id=$2 ORDER BY created_at DESC",
    [scope.organizationId, scope.botId],
  );
  res.json(result.rows);
});
app.post("/documents", async (req, res) => {
  const scope = scopeSchema.parse(res.locals.scope),
    input = uploadSchema.parse(req.body);
  const data = Buffer.from(input.content, "base64");
  try {
    validateFile(input.name, input.type, data);
  } catch (error) {
    throw new HttpError(400, (error as Error).message);
  }
  const digest = hash(data.toString("base64"));
  const existing = await pool.query(
    "SELECT id FROM documents WHERE bot_id=$1 AND organization_id=$2 AND digest=$3",
    [scope.botId, scope.organizationId, digest],
  );
  if (existing.rows[0]) {
    res.status(200).json(existing.rows[0]);
    return;
  }
  const id = randomUUID(),
    key = scope.organizationId + "/" + scope.botId + "/" + id;
  await putObject(key, data, input.type);
  try {
    await transaction(async (c) => {
      // A bot row lock serializes quota checks across simultaneous uploads.
      await c.query(
        "SELECT id FROM bots WHERE id=$1 AND organization_id=$2 FOR UPDATE",
        [scope.botId, scope.organizationId],
      );
      const count = await c.query(
        "SELECT count(*)::int AS count FROM documents WHERE bot_id=$1",
        [scope.botId],
      );
      if (count.rows[0].count >= 50)
        throw new HttpError(409, "This bot has reached its 50-document limit.");
      await c.query(
        "INSERT INTO documents(id,organization_id,bot_id,name,type,object_key,digest,bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          id,
          scope.organizationId,
          scope.botId,
          input.name,
          input.type,
          key,
          digest,
          data.length,
        ],
      );
      await audit(scope.organizationId, null, "document.uploaded", id, c);
    });
  } catch (error) {
    await deleteObject(key);
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "This document is already uploaded." });
      return;
    }
    throw error;
  }
  res.status(201).json({ id });
});
app.delete("/documents/:id", async (req, res) => {
  const scope = scopeSchema.parse(res.locals.scope),
    id = z.uuid().parse(req.params.id);
  await transaction(async (c) => {
    const result = await c.query(
      "SELECT object_key FROM documents WHERE id=$1 AND organization_id=$2 AND bot_id=$3 FOR UPDATE",
      [id, scope.organizationId, scope.botId],
    );
    if (!result.rows[0]) throw new HttpError(404, "Document not found.");
    await deleteObject(result.rows[0].object_key as string);
    await c.query("DELETE FROM documents WHERE id=$1", [id]);
    await audit(scope.organizationId, null, "document.deleted", id, c);
  });
  res.json({ ok: true });
});
app.post("/documents/:id/retry", async (req, res) => {
  const scope = scopeSchema.parse(res.locals.scope),
    id = z.uuid().parse(req.params.id);
  const result = await pool.query(
    "UPDATE documents SET status='queued',attempts=0,error=NULL,lease_id=NULL,lease_until=NULL WHERE id=$1 AND organization_id=$2 AND bot_id=$3 AND status='failed' RETURNING id",
    [id, scope.organizationId, scope.botId],
  );
  if (!result.rowCount) throw new HttpError(404, "Failed document not found.");
  res.json({ ok: true });
});
app.post("/answer", async (req, res) => {
  const scope = scopeSchema.parse(res.locals.scope);
  const input = searchSchema.parse({ ...req.body, ...scope });
  const vectors = await embed([input.question]);
  const vector = vectors?.[0] ? JSON.stringify(vectors[0]) : null;
  const result = await pool.query(
    `SELECT c.document_id AS "documentId", d.name, c.page, c.content AS excerpt,
    ts_rank_cd(to_tsvector('english',c.content),plainto_tsquery('english',$3)) AS lexical,
    CASE WHEN c.embedding IS NOT NULL AND $4::vector IS NOT NULL THEN 1-(c.embedding <=> $4::vector) ELSE 0 END AS similarity
    FROM chunks c JOIN documents d ON d.id=c.document_id
    WHERE c.organization_id=$1 AND c.bot_id=$2 AND d.status='ready'
    AND (to_tsvector('english',c.content) @@ plainto_tsquery('english',$3)
    OR (c.embedding IS NOT NULL AND $4::vector IS NOT NULL AND (c.embedding <=> $4::vector)<0.65))
    ORDER BY (ts_rank_cd(to_tsvector('english',c.content),plainto_tsquery('english',$3)) +
    CASE WHEN c.embedding IS NOT NULL AND $4::vector IS NOT NULL THEN 1-(c.embedding <=> $4::vector) ELSE 0 END) DESC LIMIT 4`,
    [scope.organizationId, scope.botId, input.question, vector],
  );
  res.json(await answer(input.question, result.rows));
});
app.use(errors);
await ensureBucket();
app.listen(4101, "0.0.0.0", () =>
  console.log("Knowledge service listening on 4101"),
);
