import { Dialog } from "@repo/ui/dialog";
import { useState } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import type { Document } from "@relay/contracts";
import { api, post } from "./api";
export default function Knowledge({
  documents,
  canManage,
  uploading,
  upload,
  browse,
  sample,
  botId,
  refresh,
  onError,
}: {
  documents: Document[];
  canManage: boolean;
  uploading: boolean;
  upload: (file?: File) => Promise<void>;
  browse: () => void;
  sample: () => Promise<void>;
  botId: string;
  refresh: () => Promise<void>;
  onError: (e: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [pending, setPending] = useState<Document | null>(null),
    [busy, setBusy] = useState(false);
  async function remove() {
    if (!pending) return;
    setBusy(true);
    try {
      await api("/bots/" + botId + "/documents/" + pending.id, {
        method: "DELETE",
      });
      setPending(null);
      await refresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="knowledge-summary">
        <div>
          <span className="section-icon">
            <BookOpen size={22} />
          </span>
          <div>
            <strong>
              {documents.filter((d) => d.status === "ready").length} sources
              ready to help
            </strong>
            <p>
              {documents.reduce((sum, d) => sum + d.chunks, 0)} searchable
              passages · {documents.length} of 50 documents
            </p>
          </div>
        </div>
        <span className="badge green">
          <ShieldCheck size={13} /> Private to this assistant
        </span>
      </div>
      {canManage && (
        <div
          className={"dropzone " + (uploading ? "busy" : "")}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) void upload(e.dataTransfer.files[0]);
          }}
        >
          <span className="upload-icon">
            <UploadCloud size={27} />
          </span>
          <h3>
            {uploading
              ? "Bringing your knowledge in…"
              : "Drop in a little expertise."}
          </h3>
          <p>
            Drag a document here, or{" "}
            <button onClick={browse} disabled={uploading}>
              browse your files
            </button>
          </p>
          <small>
            PDF, TXT, or Markdown · Up to 5 MB per file · Text-based PDFs
          </small>
        </div>
      )}
      <section className="panel document-panel">
        <div className="panel-title">
          <div>
            <h3>
              Your sources{" "}
              <span className="count-pill">{documents.length}</span>
            </h3>
            <p>The knowledge behind every good answer.</p>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              aria-label="Search documents"
              placeholder="Find a source…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        {documents.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DOCUMENT</th>
                  <th>STATUS</th>
                  <th>PASSAGES</th>
                  <th>ADDED</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {documents
                  .filter((d) =>
                    d.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <div className="file-cell">
                          <span className="file-icon">
                            <FileText size={21} />
                            <small>
                              {d.name.split(".").pop()?.toUpperCase()}
                            </small>
                          </span>
                          <div>
                            <strong>{d.name}</strong>
                            <small>
                              {(d.bytes / 1024).toFixed(1)} KB
                              {d.error && (
                                <span className="document-error">
                                  {d.error}
                                </span>
                              )}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (d.status === "ready"
                              ? "green"
                              : d.status === "failed"
                                ? "red"
                                : "amber")
                          }
                        >
                          <i className="dot" />
                          {d.status === "ready"
                            ? "Ready"
                            : d.status === "failed"
                              ? "Needs attention"
                              : d.status === "queued"
                                ? "Queued"
                                : "Processing"}
                        </span>
                      </td>
                      <td>{d.chunks || "—"}</td>
                      <td>
                        {new Date(d.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td>
                        {canManage && (
                          <div className="row-actions">
                            {d.status === "failed" && (
                              <button
                                className="icon-button"
                                aria-label={"Retry " + d.name}
                                onClick={() =>
                                  void post(
                                    "/bots/" +
                                      botId +
                                      "/documents/" +
                                      d.id +
                                      "/retry",
                                  )
                                    .then(refresh)
                                    .catch((e) => onError((e as Error).message))
                                }
                              >
                                <RefreshCw size={16} />
                              </button>
                            )}
                            <button
                              className="icon-button"
                              aria-label={"Delete " + d.name}
                              onClick={() => setPending(d)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!documents.some((d) =>
              d.name.toLowerCase().includes(query.toLowerCase()),
            ) && <p className="no-results">No sources match “{query}”.</p>}
          </div>
        ) : (
          <div className="empty-state">
            <BookOpen size={30} />
            <h3>Your assistant is ready to learn.</h3>
            <p>Add your first document, or try a sample support guide.</p>
            {canManage && (
              <button
                className="button"
                disabled={uploading}
                onClick={() => void sample()}
              >
                <Plus size={15} /> Add sample knowledge
              </button>
            )}
          </div>
        )}
      </section>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <p>
          <strong>Only your knowledge. Only your workspace.</strong> Uploaded
          documents are privately stored and indexed for this assistant. Answers
          include sources so you can see where they came from.
        </p>
      </div>
      {pending && (
        <Dialog
          labelledBy="delete-title"
          onClose={() => {
            if (!busy) setPending(null);
          }}
        >
          {" "}
          <h2 id="delete-title">Remove this source?</h2>
          <p>
            “{pending.name}” and its indexed passages will be deleted. Your
            assistant will stop using it for new answers. Existing conversations
            keep their source excerpts.
          </p>
          <div className="modal-actions">
            <button
              className="button"
              onClick={() => setPending(null)}
              disabled={busy}
            >
              Keep source
            </button>
            <button
              className="button danger"
              onClick={() => void remove()}
              disabled={busy}
            >
              Delete source
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
