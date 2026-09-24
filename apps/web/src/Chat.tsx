import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  Headphones,
  MessageCircle,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { Bot, Conversation } from "@relay/contracts";
import { api, post } from "./api";
type ChatBot = Pick<Bot, "name" | "greeting" | "color">;
export default function Chat({
  bot,
  chatId,
  onNew,
  visitor = false,
  agent = false,
  readOnly = false,
  onUpdate,
  onError,
}: {
  bot: ChatBot;
  chatId: string | null;
  onNew: () => Promise<string>;
  visitor?: boolean;
  agent?: boolean;
  readOnly?: boolean;
  onUpdate?: (chat: Conversation) => void;
  onError: (text: string) => void;
}) {
  const [chat, setChat] = useState<Conversation | null>(null),
    [text, setText] = useState(""),
    [sending, setSending] = useState(false),
    [expanded, setExpanded] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const prefix = visitor ? "/public/conversations/" : "/conversations/";
  useEffect(() => {
    setChat(null);
    setText("");
    if (!chatId) return;
    let alive = true;
    const refresh = () =>
      api<Conversation>(prefix + chatId)
        .then((c) => {
          if (alive) setChat(c);
        })
        .catch((e) => {
          if (alive) onError((e as Error).message);
        });
    void refresh();
    const timer = setInterval(() => void refresh(), 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [chatId, prefix, onError]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat?.messages.length, sending]);
  async function send(value = text) {
    if (!value.trim() || sending) return;
    setSending(true);
    try {
      const id = chatId ?? (await onNew());
      const c = await post<Conversation>(
        prefix + id + (agent ? "/reply" : "/messages"),
        { content: value, requestId: crypto.randomUUID() },
      );
      setChat(c);
      setText("");
      onUpdate?.(c);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  async function action(name: string) {
    try {
      const id = chatId ?? (await onNew());
      const c = await post<Conversation>(prefix + id + "/" + name);
      setChat(c);
      onUpdate?.(c);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  const mode = chat?.mode ?? "ai";
  return (
    <div className="chat-card">
      <div className="chat-top">
        <div className="bot-avatar" style={{ background: bot.color }}>
          <Sparkles size={20} />
          <span />
        </div>
        <div>
          <strong>{bot.name}</strong>
          <small>
            <i className={"dot " + (mode === "ai" ? "green" : "amber")} />
            {mode === "ai"
              ? "Here to help"
              : mode === "waiting"
                ? "Waiting for a teammate"
                : mode === "human"
                  ? "Connected to a person"
                  : "Conversation resolved"}
          </small>
        </div>
        <button
          className="icon-button"
          title="Start a new conversation"
          aria-label="Start a new conversation"
          onClick={() =>
            void onNew().catch((e) => onError((e as Error).message))
          }
        >
          <RotateCcw size={17} />
        </button>
      </div>
      {agent && (
        <div className="agent-controls">
          <span>
            <Headphones size={15} /> Agent workspace
          </span>
          {mode !== "resolved" && (
            <>
              <button
                className="button primary small"
                onClick={() => void action("takeover")}
              >
                Join conversation
              </button>
              {["human", "waiting"].includes(mode) && (
                <button
                  className="button small"
                  onClick={() => void action("release")}
                >
                  Return to AI
                </button>
              )}
              <button
                className="button small"
                onClick={() => void action("resolve")}
              >
                Resolve <Check size={13} />
              </button>
            </>
          )}
        </div>
      )}
      <div
        className="chat-messages"
        role="log"
        aria-label="Conversation messages"
        aria-live="polite"
      >
        <div className="chat-date">Your conversation starts here</div>
        <div className="message assistant">
          <span className="message-icon">
            <Sparkles size={15} />
          </span>
          <div className="bubble">{bot.greeting}</div>
        </div>
        {!chat?.messages.length && !agent && (
          <div className="suggestions">
            {[
              "What is your return policy?",
              "How long does shipping take?",
              "How can I contact support?",
            ].map((q) => (
              <button key={q} onClick={() => void send(q)} disabled={sending}>
                {q}
                <ArrowUp size={14} />
              </button>
            ))}
          </div>
        )}
        {chat?.messages.map((m) =>
          m.role === "system" ? (
            <div className="system-message" key={m.id}>
              {m.content}
            </div>
          ) : (
            <div
              className={
                "message " + (m.role === "customer" ? "customer" : "assistant")
              }
              key={m.id}
            >
              {m.role !== "customer" && (
                <span
                  className={
                    "message-icon " + (m.role === "agent" ? "human-icon" : "")
                  }
                >
                  {m.role === "agent" ? (
                    <Headphones size={15} />
                  ) : (
                    <Sparkles size={15} />
                  )}
                </span>
              )}
              <div>
                <div className="bubble">
                  {m.role === "agent" && (
                    <strong className="agent-label">Support teammate</strong>
                  )}
                  {m.content}
                </div>
                {m.citations.length > 0 && (
                  <div className="citation">
                    <button
                      onClick={() =>
                        setExpanded(expanded === m.id ? null : m.id)
                      }
                    >
                      <BookOpen size={13} />
                      {m.citations.length} source
                      {m.citations.length > 1 ? "s" : ""}
                      <ChevronDown size={13} />
                    </button>
                    {expanded === m.id &&
                      m.citations.map((c, i) => (
                        <div className="source-excerpt" key={i}>
                          <strong>
                            [{i + 1}] {c.name} · Page {c.page}
                          </strong>
                          <p>{c.excerpt}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {sending && (
          <div className="message assistant">
            <span className="message-icon">
              <Sparkles size={15} />
            </span>
            <div className="bubble typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      {!readOnly && !agent && mode === "ai" && (
        <button
          className="human-request"
          onClick={() => void action("handoff")}
        >
          <Headphones size={14} /> Prefer a person? Talk to our team
        </button>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          aria-label={agent ? "Reply as agent" : "Your message"}
          placeholder={agent ? "Reply as a teammate…" : "Ask us anything…"}
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          disabled={
            readOnly || mode === "resolved" || (agent && mode !== "human")
          }
        />
        <button
          className="send-button"
          aria-label="Send message"
          disabled={
            readOnly ||
            sending ||
            !text.trim() ||
            mode === "resolved" ||
            (agent && mode !== "human")
          }
        >
          <ArrowUp size={19} />
        </button>
      </form>
      <div className="chat-footer">
        <MessageCircle size={12} /> Powered by <strong>relay</strong>
        <span>Thoughtful support, together.</span>
      </div>
    </div>
  );
}
