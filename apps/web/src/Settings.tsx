import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Link,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import type { Bot, Workspace } from "@relay/contracts";
import { api, post } from "./api";
type Member = { id: string; name: string; email: string; role: string };
export function Settings({
  bot,
  canManage,
  onSaved,
  onCreated,
  onError,
  notice,
}: {
  bot: Bot;
  canManage: boolean;
  onSaved: (b: Bot) => void;
  onCreated: (b: Bot) => void;
  onError: (e: string) => void;
  notice: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function save(form: HTMLFormElement) {
    setBusy(true);
    const data = new FormData(form);
    try {
      onSaved(
        await api<Bot>("/bots/" + bot.id, {
          method: "PATCH",
          body: JSON.stringify({
            name: data.get("name"),
            greeting: data.get("greeting"),
            color: data.get("color"),
            published: data.get("published") === "on",
          }),
        }),
      );
      notice("Your assistant settings are saved.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function create(form: HTMLFormElement) {
    setBusy(true);
    try {
      const data = new FormData(form),
        created = await post<Bot>(
          "/organizations/" + bot.organization_id + "/bots",
          {
            name: data.get("name"),
            greeting: "Hi there! How can I help you today?",
            color: "#7258f5",
            published: false,
          },
        );
      onCreated(created);
      form.reset();
      notice("Your new assistant is ready for its first document.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="panel-title">
          <div>
            <h3>A voice that feels like you</h3>
            <p>The little details that make your assistant familiar.</p>
          </div>
          <Sparkles size={20} />
        </div>
        <form
          key={bot.id + bot.name + String(bot.published)}
          onSubmit={(e) => {
            e.preventDefault();
            void save(e.currentTarget);
          }}
        >
          <label>
            Assistant name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={bot.name}
              disabled={!canManage}
            />
          </label>
          <label>
            Welcome message
            <textarea
              name="greeting"
              required
              minLength={2}
              maxLength={500}
              defaultValue={bot.greeting}
              disabled={!canManage}
              rows={3}
            />
            <small>The first hello your customers see.</small>
          </label>
          <label>
            Brand color
            <div className="color-input">
              <input
                type="color"
                name="color"
                defaultValue={bot.color}
                disabled={!canManage}
              />
              <span>Choose your assistant’s accent color</span>
            </div>
          </label>
          <label className="toggle-label">
            <div>
              <strong>Publish your customer chat</strong>
              <small>
                Anyone with the link can start a private conversation with this
                bot. Its knowledge will be used to answer their questions.
              </small>
            </div>
            <input
              name="published"
              type="checkbox"
              defaultChecked={bot.published}
              disabled={!canManage}
            />
          </label>
          {canManage && (
            <button className="button primary" disabled={busy}>
              Save changes <Check size={15} />
            </button>
          )}
        </form>
      </section>
      <div>
        <section className="panel share-panel">
          <span className="section-icon">
            <Link size={22} />
          </span>
          <h3>One link. A warm welcome.</h3>
          <p>
            Let customers chat with your assistant right here on Relay. Your
            team can join from the inbox.
          </p>
          {bot.published ? (
            <>
              <label>
                Your customer chat link
                <div className="share-link">
                  <input
                    readOnly
                    value={window.location.origin + "/chat/" + bot.public_id}
                  />
                  <button
                    className="icon-button"
                    aria-label="Copy chat link"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(
                          window.location.origin + "/chat/" + bot.public_id,
                        )
                        .then(() => notice("Chat link copied."))
                        .catch(() =>
                          onError("Select and copy the link manually."),
                        )
                    }
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </label>
              <a
                className="button full"
                target="_blank"
                rel="noreferrer"
                href={"/chat/" + bot.public_id}
              >
                Open customer chat <ExternalLink size={15} />
              </a>
            </>
          ) : (
            <span className="badge neutral">
              Publish your assistant to activate its link
            </span>
          )}
        </section>
        {canManage && (
          <section className="panel new-bot-panel">
            <h3>A new assistant, a fresh start.</h3>
            <p>
              Create a separate bot with its own documents and conversations.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void create(e.currentTarget);
              }}
            >
              <label>
                New assistant name
                <input
                  name="name"
                  placeholder="e.g. Product support"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </label>
              <button className="button" disabled={busy}>
                <Plus size={15} /> Create assistant
              </button>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
export function Team({
  workspace,
  onError,
  notice,
}: {
  workspace: Workspace;
  onError: (e: string) => void;
  notice: (s: string) => void;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void api<Member[]>("/organizations/" + workspace.id + "/members")
      .then((m) => {
        if (active) setMembers(m);
      })
      .catch((e) => onError((e as Error).message));
    return () => {
      active = false;
    };
  }, [workspace.id, onError]);
  async function add(form: HTMLFormElement) {
    setBusy(true);
    try {
      await post(
        "/organizations/" + workspace.id + "/members",
        Object.fromEntries(new FormData(form)),
      );
      setMembers(
        await api<Member[]>("/organizations/" + workspace.id + "/members"),
      );
      form.reset();
      notice("Teammate access updated.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-title">
          <div>
            <h3>People behind the answers</h3>
            <p>Everyone who makes your support feel human.</p>
          </div>
          <Users size={20} />
        </div>
        {members.map((m) => (
          <div className="member-row" key={m.id}>
            <span className="avatar lilac">{m.name.slice(0, 1)}</span>
            <div>
              <strong>{m.name}</strong>
              <small>{m.email}</small>
            </div>
            <span className="badge neutral">{m.role.toLowerCase()}</span>
          </div>
        ))}
      </section>
      <section className="panel settings-panel">
        <h3>Bring a teammate along</h3>
        <p>
          Ask them to create a Relay account first. Then add their email to give
          them access to this company. Adding an existing member updates their
          role.
        </p>
        {workspace.role === "OWNER" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void add(e.currentTarget);
            }}
          >
            <label>
              Teammate’s email
              <input
                type="email"
                name="email"
                required
                placeholder="teammate@company.com"
              />
            </label>
            <label>
              Workspace role
              <select name="role">
                <option value="AGENT">
                  Agent — join and reply to conversations
                </option>
                <option value="ADMIN">Admin — manage knowledge and bots</option>
                <option value="VIEWER">Viewer — read-only access</option>
              </select>
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Add teammate
            </button>
          </form>
        ) : (
          <div className="info-strip">
            Your workspace owner can add or change teammates.
          </div>
        )}
      </section>
    </div>
  );
}
