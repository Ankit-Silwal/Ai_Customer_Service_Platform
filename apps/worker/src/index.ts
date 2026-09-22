import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { pool, transaction } from "@relay/server/db";
import { getObject } from "@relay/server/storage";
import { chunkPages } from "@relay/server/documents";
import { embed } from "@relay/server/ai";

let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
console.log("Document worker started");
while (running) {
  const lease = randomUUID();
  const job = await transaction(async (c) => {
    await c.query(
      "UPDATE documents SET status='failed',error='Processing timed out. Please retry.',lease_id=NULL WHERE status='processing' AND lease_until<now() AND attempts>=3",
    );
    const result = await c.query(
      `UPDATE documents SET status='processing', attempts=attempts+1, lease_id=$1, lease_until=now()+interval '2 minutes'
      WHERE id=(SELECT id FROM documents WHERE (status='queued' OR (status='processing' AND lease_until<now())) AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,
      [lease],
    );
    return result.rows[0] as
      | {
          id: string;
          organization_id: string;
          bot_id: string;
          object_key: string;
          type: string;
          attempts: number;
        }
      | undefined;
  });
  if (!job) {
    await setTimeout(1000);
    continue;
  }
  const heartbeat = setInterval(() => {
    void pool
      .query(
        "UPDATE documents SET lease_until=now()+interval '2 minutes' WHERE id=$1 AND lease_id=$2",
        [job.id, lease],
      )
      .catch(() => {});
  }, 30_000);
  try {
    const data = await getObject(job.object_key);
    const pages: { page: number; text: string }[] = [];
    if (job.type === "application/pdf") {
      const loadingTask = getDocument({
        data: new Uint8Array(data),
        useSystemFonts: true,
      });
      const pdf = await loadingTask.promise;
      try {
        if (pdf.numPages > 200)
          throw new Error("PDF exceeds the 200-page limit.");
        for (let page = 1; page <= pdf.numPages; page++) {
          const content = await (await pdf.getPage(page)).getTextContent();
          pages.push({
            page,
            text: content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          });
        }
      } finally {
        await loadingTask.destroy();
      }
    } else pages.push({ page: 1, text: data.toString("utf8") });
    const chunks = chunkPages(pages);
    const embeddings: (number[] | null)[] = [];
    for (let i = 0; i < chunks.length; i += 20) {
      const batch = chunks.slice(i, i + 20);
      const vectors = await embed(batch.map((c) => c.text));
      embeddings.push(...batch.map((_c, j) => vectors?.[j] ?? null));
    }
    await transaction(async (c) => {
      const active = await c.query(
        "SELECT id FROM documents WHERE id=$1 AND lease_id=$2 FOR UPDATE",
        [job.id, lease],
      );
      if (!active.rowCount) return;
      await c.query("DELETE FROM chunks WHERE document_id=$1", [job.id]);
      for (const [i, chunk] of chunks.entries())
        await c.query(
          "INSERT INTO chunks(document_id,organization_id,bot_id,page,ordinal,content,embedding) VALUES($1,$2,$3,$4,$5,$6,$7::vector)",
          [
            job.id,
            job.organization_id,
            job.bot_id,
            chunk.page,
            i,
            chunk.text,
            embeddings[i] ? JSON.stringify(embeddings[i]) : null,
          ],
        );
      await c.query(
        "UPDATE documents SET status='ready',chunks=$2,error=NULL,lease_id=NULL,lease_until=NULL WHERE id=$1",
        [job.id, chunks.length],
      );
    });
    console.log(
      JSON.stringify({
        event: "document.ready",
        id: job.id,
        chunks: chunks.length,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error &&
      /No readable|too long|200-page/.test(error.message)
        ? error.message
        : "Document processing failed. Check the file and AI provider configuration, then retry.";
    await pool.query(
      "UPDATE documents SET status=$3,error=$4,lease_id=NULL,lease_until=NULL WHERE id=$1 AND lease_id=$2",
      [
        job.id,
        lease,
        job.attempts >= 3 || /No readable|too long|200-page/.test(message)
          ? "failed"
          : "queued",
        message,
      ],
    );
    console.error(
      JSON.stringify({
        event: "document.failed",
        id: job.id,
        attempt: job.attempts,
      }),
    );
  } finally {
    clearInterval(heartbeat);
  }
}
await pool.end();
