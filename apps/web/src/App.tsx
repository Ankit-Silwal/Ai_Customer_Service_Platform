import { Dialog } from "@repo/ui/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FlaskConical,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { Bot, Conversation, Document, Me } from "@relay/contracts";
import Auth from "./Auth";
import Chat from "./Chat";
import Overview, { type Page } from "./Overview";
import Knowledge from "./Knowledge";
import { Settings, Team } from "./Settings";
import PublicChat from "./PublicChat";
import { api, post, fileBase64, sampleText } from "./api";
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "knowledge", label: "Knowledge base", icon: BookOpen },
  { id: "playground", label: "Playground", icon: FlaskConical },
  { id: "inbox", label: "Team inbox", icon: MessageCircle },
  { id: "team", label: "Teammates", icon: Users },
  { id: "settings", label: "Bot settings", icon: SettingsIcon },
] as const;
const titles: Record<Page, string> = {
  overview: "A good day for great support.",
  knowledge: "A little knowledge goes a long way.",
  playground: "Meet your new support teammate.",
  inbox: "Every conversation, in good hands.",
  team: "Better support is a team effort.",
  settings: "Make your assistant your own.",
};
const subtitles: Record<Page, string> = {
  overview: "Your knowledge, your AI, and your team. All working together.",
  knowledge:
    "Give your assistant the context it needs to give answers that matter.",
  playground:
    "Ask a question, check the sources, and see it from your customer’s side.",
  inbox: "Pick up right where your assistant left off. No repeating the story.",
  team: "Bring the right people into the conversation.",
  settings:
    "A familiar voice. A friendly welcome. A natural extension of your brand.",
};
export default function App() {
  const [me, setMe] = useState<Me | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState<Page>("overview"),
    [organization, setOrganization] = useState(""),
    [bots, setBots] = useState<Bot[]>([]),
    [botId, setBotId] = useState(""),
    [documents, setDocuments] = useState<Document[]>([]),
    [conversations, setConversations] = useState<Conversation[]>([]),
    [chatId, setChatId] = useState<string | null>(null),
    [inboxId, setInboxId] = useState<string | null>(null),
    [uploading, setUploading] = useState(false),
    [query, setQuery] = useState(""),
    [mobile, setMobile] = useState(false),
    [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null),
    showError = useCallback((text: string) => setError(text), []);
  const publicId = window.location.pathname.startsWith("/chat/")
    ? window.location.pathname.split("/")[2]
    : null;
  const workspace = me?.organizations.find((o) => o.id === organization),
    bot = bots.find((b) => b.id === botId),
    canManage = workspace?.role === "OWNER" || workspace?.role === "ADMIN",
    canChat = workspace?.role !== "VIEWER";
  const reloadMe = useCallback(async () => {
    const result = await api<Me>("/me");
    setMe(result);
    setOrganization((current) =>
      result.organizations.some((o) => o.id === current)
        ? current
        : (result.organizations[0]?.id ?? ""),
    );
  }, []);
  useEffect(() => {
    if (publicId) {
      setLoading(false);
      return;
    }
    void reloadMe()
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [reloadMe, publicId]);
  useEffect(() => {
    if (!organization) return;
    let active = true;
    setBots([]);
    setBotId("");
    setDocuments([]);
    setConversations([]);
    setChatId(null);
    setInboxId(null);
    void api<Bot[]>("/organizations/" + organization + "/bots")
      .then((b) => {
        if (active) {
          setBots(b);
          setBotId(b[0]?.id ?? "");
        }
      })
      .catch((e) => showError((e as Error).message));
    return () => {
      active = false;
    };
  }, [organization, showError]);
  useEffect(() => {
    if (!botId) return;
    let active = true;
    setDocuments([]);
    setConversations([]);
    setChatId(null);
    setInboxId(null);
    const refresh = () =>
      Promise.all([
        api<Document[]>("/bots/" + botId + "/documents"),
        api<Conversation[]>("/bots/" + botId + "/conversations"),
      ])
        .then(([docs, chats]) => {
          if (active) {
            setDocuments(docs);
            setConversations(chats);
          }
        })
        .catch((e) => {
          if (active) showError((e as Error).message);
        });
    void refresh();
    const timer = setInterval(() => void refresh(), 3500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [botId, showError]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function refresh() {
    if (!botId) return;
    const [docs, chats] = await Promise.all([
      api<Document[]>("/bots/" + botId + "/documents"),
      api<Conversation[]>("/bots/" + botId + "/conversations"),
    ]);
    setDocuments(docs);
    setConversations(chats);
  }
  async function createChat() {
    const c = await post<{ id: string }>("/bots/" + botId + "/conversations");
    setChatId(c.id);
    return c.id;
  }
  async function upload(file?: File) {
    if (!file || !bot) return;
    if (file.size > 5 * 1024 * 1024) {
      showError("Please choose a file smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const type = file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : file.name.toLowerCase().endsWith(".md")
          ? "text/markdown"
          : "text/plain";
      await post("/bots/" + bot.id + "/documents", {
        name: file.name,
        type,
        content: await fileBase64(file),
      });
      await refresh();
      setNotice("Document uploaded. We are getting it ready for your bot.");
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }
  function navigate(id: Page) {
    setPage(id);
    setMobile(false);
    setQuery("");
    setError("");
  }
  if (publicId) return <PublicChat publicId={publicId} />;
  if (loading)
    return (
      <div className="loading-screen">
        <span className="brand-mark">
          <MessageCircle />
        </span>
        <p>Making room for great conversations…</p>
      </div>
    );
  if (!me) return <Auth onSuccess={reloadMe} />;
  const ready = documents.filter((d) => d.status === "ready").length,
    waiting = conversations.filter((c) => c.mode === "waiting").length;
  return (
    <div className="app-shell">
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <a className="brand" href="/">
          <span className="brand-mark">
            <MessageCircle size={22} />
          </span>
          relay<span className="brand-period">.</span>
        </a>
        <div className="workspace-select">
          <span className="workspace-avatar">
            {workspace?.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <small>WORKSPACE</small>
            <select
              aria-label="Company workspace"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            >
              {me.organizations.map((o) => (
                <option value={o.id} key={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-caption">YOUR WORKSPACE</span>
        <nav>
          {navigation
            .filter((n) => n.id !== "team" || canManage)
            .map((n) => (
              <button
                key={n.id}
                className={page === n.id ? "active" : ""}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                {n.label}
                {n.id === "inbox" && waiting > 0 && (
                  <span className="nav-count">{waiting}</span>
                )}
                {n.id === "playground" && (
                  <span className="nav-new">TRY IT</span>
                )}
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <Sparkles size={19} />
            </span>
            <strong>A smarter first hello.</strong>
            <p>Add your knowledge. Let your assistant take it from there.</p>
            <button onClick={() => navigate("knowledge")}>
              Build your knowledge <ArrowRight size={14} />
            </button>
          </div>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Getting started <ExternalLink size={13} />
          </button>
          <div className="profile">
            <span className="avatar lilac">{me.user.name.slice(0, 1)}</span>
            <div>
              <strong>{me.user.name}</strong>
              <small>
                {workspace?.role.toLowerCase()} · {workspace?.name}
              </small>
            </div>
            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              onClick={() =>
                void post("/auth/logout")
                  .then(() => setMe(null))
                  .catch((e) => showError((e as Error).message))
              }
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={20} />
          </button>
          <span className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{navigation.find((n) => n.id === page)?.label}</strong>
          </span>
          <div className="topbar-right">
            <span className="connection">
              <i className="dot green" /> Your workspace is private
            </span>
            <button
              className="button small"
              onClick={() => navigate("playground")}
            >
              <FlaskConical size={14} /> Test your bot
            </button>
            <span className="avatar tiny lilac">
              {me.user.name.slice(0, 1)}
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow purple">
                {page === "overview"
                  ? "YOUR SUPPORT, CONNECTED"
                  : navigation.find((n) => n.id === page)?.label.toUpperCase()}
              </span>
              <h1>{titles[page]}</h1>
              <p>{subtitles[page]}</p>
            </div>
            {canManage && page !== "settings" && page !== "team" && (
              <button
                className="button primary"
                onClick={() => input.current?.click()}
                disabled={uploading}
              >
                <Plus size={17} />
                {uploading ? "Uploading…" : "Add knowledge"}
              </button>
            )}
          </div>
          {error && (
            <div className="error dismissable" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <input
            ref={input}
            className="visually-hidden"
            type="file"
            accept=".pdf,.txt,.md"
            aria-label="Upload knowledge file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <div className="bot-selector-row">
            <span className="mini-logo">
              <Sparkles size={15} />
            </span>
            <select
              aria-label="Select assistant"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
            >
              {bots.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <span className={"badge " + (bot?.published ? "green" : "neutral")}>
              {bot?.published ? "Published" : "Private draft"}
            </span>
            <span className="bot-selector-detail">
              Knowledge and conversations belong to this assistant
            </span>
          </div>
          {!bot && (
            <div className="empty-state">
              <Sparkles size={32} />
              <h3>
                {me.organizations.length
                  ? "Loading your workspace…"
                  : "You do not have an active workspace."}
              </h3>
            </div>
          )}
          {bot && page === "overview" && (
            <Overview
              bot={bot}
              documents={documents}
              conversations={conversations}
              navigate={navigate}
              selectChat={(id) => {
                setInboxId(id);
                navigate("inbox");
              }}
              help={() => setHelp(true)}
            />
          )}
          {bot && page === "knowledge" && (
            <Knowledge
              documents={documents}
              canManage={canManage}
              uploading={uploading}
              upload={upload}
              browse={() => input.current?.click()}
              sample={() =>
                upload(
                  new File([sampleText], "Northstar support guide.md", {
                    type: "text/markdown",
                  }),
                )
              }
              botId={bot.id}
              refresh={refresh}
              onError={showError}
            />
          )}
          {bot && page === "playground" && (
            <div className="playground-layout">
              <section className="playground-info">
                <div className="panel">
                  <span className="eyebrow purple">
                    THE CUSTOMER EXPERIENCE
                  </span>
                  <h2>
                    A space to
                    <br />
                    ask, learn, and refine.
                  </h2>
                  <p>
                    This is your real assistant, connected to your real
                    knowledge. Give it a question your customers would ask.
                  </p>
                  <div className="playground-check">
                    <Check size={16} />
                    <div>
                      <strong>{ready} connected sources</strong>
                      <small>
                        {ready
                          ? "Your knowledge is ready for a conversation."
                          : "Add a document to get grounded answers."}
                      </small>
                    </div>
                  </div>
                  <div className="playground-check">
                    <BookOpen size={16} />
                    <div>
                      <strong>Answers you can trace</strong>
                      <small>
                        Open a source below an answer to check the evidence.
                      </small>
                    </div>
                  </div>
                  <div className="playground-check">
                    <Headphones size={16} />
                    <div>
                      <strong>A person is one click away</strong>
                      <small>
                        Request a person, then open Team inbox to join.
                      </small>
                    </div>
                  </div>
                  <button
                    className="button full"
                    onClick={() => navigate("knowledge")}
                  >
                    <BookOpen size={16} /> Manage knowledge{" "}
                    <ArrowRight size={15} />
                  </button>
                </div>
                <div
                  className={
                    "provider-note " + (!me.aiEnabled ? "preview-mode" : "")
                  }
                >
                  <Sparkles size={18} />
                  <div>
                    <strong>
                      {me.aiEnabled
                        ? "AI answers enabled"
                        : "Source preview mode"}
                    </strong>
                    <p>
                      {me.aiEnabled
                        ? "Responses are generated using your assistant’s knowledge."
                        : "You can test retrieval now. Add a server-side AI API key to enable generated answers."}
                    </p>
                  </div>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("inbox")}
                >
                  Try a human handoff <ArrowRight size={15} />
                </button>
              </section>
              {canChat ? (
                <Chat
                  key={bot.id}
                  bot={bot}
                  chatId={chatId}
                  onNew={createChat}
                  onError={showError}
                  onUpdate={() => void refresh()}
                />
              ) : (
                <div className="panel empty-state">
                  <ShieldCheck />
                  <h3>Viewer access</h3>
                  <p>An owner, admin, or agent can start test conversations.</p>
                </div>
              )}
            </div>
          )}
          {bot && page === "inbox" && (
            <div className="inbox-layout">
              <section className="panel inbox-list">
                <div className="panel-title">
                  <h3>
                    Conversations{" "}
                    <span className="count-pill">{conversations.length}</span>
                  </h3>
                  <span className="badge amber">{waiting} waiting</span>
                </div>
                <label className="search-box">
                  <Search size={16} />
                  <input
                    aria-label="Search conversations"
                    placeholder="Find a conversation…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <div className="inbox-items">
                  {conversations
                    .filter((c) =>
                      c.title.toLowerCase().includes(query.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        className={
                          "inbox-item " + (inboxId === c.id ? "selected" : "")
                        }
                        key={c.id}
                        onClick={() => setInboxId(c.id)}
                      >
                        <span
                          className={
                            "avatar " +
                            (c.mode === "waiting" ? "peach" : "lilac")
                          }
                        >
                          <MessageCircle size={17} />
                        </span>
                        <div>
                          <strong>{c.title}</strong>
                          <span>
                            <i
                              className={
                                "dot " +
                                (c.mode === "waiting" ? "amber" : "green")
                              }
                            />
                            {c.mode === "waiting"
                              ? "Needs a person"
                              : c.mode === "human"
                                ? "With a teammate"
                                : c.mode === "resolved"
                                  ? "Resolved"
                                  : "With AI"}
                            <small>
                              {new Date(c.updated_at).toLocaleTimeString(
                                undefined,
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </small>
                          </span>
                        </div>
                      </button>
                    ))}
                  {!conversations.length && (
                    <div className="empty-state">
                      <MessageCircle size={27} />
                      <h3>Room for a conversation.</h3>
                      <p>
                        Test your assistant or share its published chat page.
                      </p>
                      <button
                        className="button"
                        onClick={() => navigate("playground")}
                      >
                        Open playground
                      </button>
                    </div>
                  )}
                </div>
              </section>
              {inboxId ? (
                <Chat
                  key={inboxId}
                  bot={bot}
                  chatId={inboxId}
                  onNew={async () => {
                    setInboxId(null);
                    return "";
                  }}
                  agent={canChat}
                  readOnly={!canChat}
                  onError={showError}
                  onUpdate={() => void refresh()}
                />
              ) : (
                <section className="panel inbox-empty">
                  <span className="large-icon">
                    <Headphones size={34} />
                  </span>
                  <h2>
                    A human touch,
                    <br />
                    right when it matters.
                  </h2>
                  <p>
                    Select a conversation to see the full story.
                    <br />
                    Join in, help out, and hand back to your assistant.
                  </p>
                  <span className="badge neutral">
                    <ShieldCheck size={13} /> AI pauses when a teammate joins
                  </span>
                </section>
              )}
            </div>
          )}
          {bot && page === "settings" && (
            <Settings
              bot={bot}
              canManage={canManage}
              onSaved={(updated) =>
                setBots((list) =>
                  list.map((b) => (b.id === updated.id ? updated : b)),
                )
              }
              onCreated={(created) => {
                setBots((list) => [...list, created]);
                setBotId(created.id);
              }}
              onError={showError}
              notice={setNotice}
            />
          )}
          {page === "team" && workspace && canManage && (
            <Team
              workspace={workspace}
              onError={showError}
              notice={setNotice}
            />
          )}
        </main>
        <footer className="page-footer">
          <span className="footer-brand">relay.</span>
          <span>A little intelligence. A lot of care.</span>
          <span>
            Made for better conversations <Sparkles size={12} />
          </span>
        </footer>
      </div>
      {help && (
        <Dialog labelledBy="help-title" onClose={() => setHelp(false)}>
          {" "}
          <button
            className="modal-close icon-button"
            aria-label="Close help"
            onClick={() => setHelp(false)}
          >
            <X />
          </button>
          <span className="section-icon">
            <Sparkles />
          </span>
          <h2 id="help-title">Your first great conversation.</h2>
          <p>
            1. Open Knowledge base and upload a PDF, TXT, or Markdown document.
            You can also use the sample guide.
          </p>
          <p>
            2. Wait for “Ready”, then ask a question in Playground. Open the
            source beneath an answer to check its evidence.
          </p>
          <p>
            3. Choose “Talk to our team”, open Team inbox, select the chat, and
            join. AI stays paused while you help.
          </p>
          <p>
            4. Publish in Bot settings to get a customer chat link. Customers
            can use it without a dashboard account.
          </p>
          <button
            className="button primary"
            onClick={() => {
              setHelp(false);
              navigate("knowledge");
            }}
          >
            Let’s get started <ArrowRight size={16} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
