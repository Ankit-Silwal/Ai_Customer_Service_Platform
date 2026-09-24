import {
  ArrowRight,
  BookOpen,
  Check,
  Headphones,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Bot, Conversation, Document } from "@relay/contracts";
import type { ReactNode } from "react";
export type Page =
  "overview" | "knowledge" | "playground" | "inbox" | "team" | "settings";
export default function Overview({
  bot,
  documents,
  conversations,
  navigate,
  selectChat,
  help,
}: {
  bot: Bot;
  documents: Document[];
  conversations: Conversation[];
  navigate: (p: Page) => void;
  selectChat: (id: string) => void;
  help: () => void;
}) {
  const ready = documents.filter((d) => d.status === "ready").length,
    waiting = conversations.filter((c) => c.mode === "waiting").length,
    human = conversations.filter((c) => c.mode === "human").length;
  return (
    <>
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker">
            <Sparkles size={14} /> GOOD ANSWERS START HERE
          </span>
          <h2>
            Your knowledge.
            <br />A helping hand, <em>24/7.</em>
          </h2>
          <p>
            Turn your company documents into thoughtful answers.
            <br className="desktop-break" /> And when a conversation needs a
            person, your team is right there.
          </p>
          <div className="hero-actions">
            <button
              className="button dark"
              onClick={() => navigate("knowledge")}
            >
              Connect your knowledge <ArrowRight size={15} />
            </button>
            <button
              className="text-button"
              onClick={() => navigate("playground")}
            >
              Try the playground <ArrowRight size={14} />
            </button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit one" />
          <div className="art-orbit two" />
          <div className="art-core">
            <Sparkles size={39} />
          </div>
          <div className="art-card source">
            <span className="art-icon mint">
              <BookOpen size={20} />
            </span>
            <div>
              <strong>Your knowledge</strong>
              <small>Connected & ready</small>
            </div>
            <Check size={14} className="green-text" />
          </div>
          <div className="art-card answer">
            <span className="art-icon lilac">
              <MessageCircle size={20} />
            </span>
            <div>
              <strong>Thoughtful answers</strong>
              <small>Grounded in your content</small>
            </div>
          </div>
          <div className="art-card people">
            <span className="avatar peach">A</span>
            <div>
              <strong>A human touch</strong>
              <small>Whenever it matters</small>
            </div>
            <i className="dot green" />
          </div>
          <span className="art-star first">✦</span>
          <span className="art-star second">✧</span>
        </div>
      </section>
      <section className="stats-grid">
        <Stat
          title="Knowledge sources"
          value={documents.length}
          detail={ready + " ready to answer"}
          icon={<BookOpen size={18} />}
          color="lilac"
        />
        <Stat
          title="Conversations"
          value={conversations.length}
          detail="Most recent 100 conversations"
          icon={<MessageCircle size={18} />}
          color="mint"
        />
        <Stat
          title="Waiting for your team"
          value={waiting}
          detail={
            waiting ? "A little human help needed" : "You’re all caught up"
          }
          icon={<Headphones size={18} />}
          color="peach"
        />
        <Stat
          title="With a teammate"
          value={human}
          detail="People and AI, working together"
          icon={<Users size={18} />}
          color="blue"
        />
      </section>
      <div className="overview-grid">
        <section className="panel setup-panel">
          <div className="panel-title">
            <div>
              <h3>Let’s get your assistant ready</h3>
              <p>Three small steps. A big difference in support.</p>
            </div>
            <span className="badge purple">
              {(ready > 0 ? 1 : 0) +
                (conversations.length > 0 ? 1 : 0) +
                (bot.published ? 1 : 0)}{" "}
              of 3
            </span>
          </div>
          <Step
            number="01"
            done={ready > 0}
            title="Give your assistant some knowledge"
            text="Upload your FAQs, guides, or company policies."
            action="Add sources"
            onClick={() => navigate("knowledge")}
          />
          <Step
            number="02"
            done={conversations.length > 0}
            title="Take it for a conversation"
            text="Ask real questions and see where answers come from."
            action="Try it out"
            onClick={() => navigate("playground")}
          />
          <Step
            number="03"
            done={bot.published}
            title="Open the door to your customers"
            text="Publish a chat page and bring your team along."
            action="Make it yours"
            onClick={() => navigate("settings")}
          />
        </section>
        <section className="panel activity-panel">
          <div className="panel-title">
            <div>
              <h3>In the conversation</h3>
              <p>Your latest customer connections.</p>
            </div>
            <MessageCircle size={18} />
          </div>
          {conversations.length ? (
            conversations.slice(0, 3).map((c) => (
              <button
                className="conversation-preview"
                key={c.id}
                onClick={() => selectChat(c.id)}
              >
                <span className="avatar lilac">
                  <MessageCircle size={16} />
                </span>
                <div>
                  <strong>{c.title}</strong>
                  <small>
                    {new Date(c.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {c.mode === "ai" ? "With your assistant" : c.mode}
                  </small>
                </div>
                <ArrowRight size={15} />
              </button>
            ))
          ) : (
            <div className="activity-empty">
              <div className="empty-art">
                <MessageCircle size={29} />
                <span>
                  <Sparkles size={15} />
                </span>
              </div>
              <h4>Your first hello is on its way.</h4>
              <p>
                Start a conversation in the playground
                <br />
                to see your assistant in action.
              </p>
              <button
                className="text-button purple-text"
                onClick={() => navigate("playground")}
              >
                Say hello <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="activity-bottom">
            <ShieldCheck size={14} /> Every conversation stays in your
            workspace.
          </div>
        </section>
      </div>
      <div className="bottom-note">
        <span>
          <span className="dot green" /> Built on your knowledge. Backed by your
          people.
        </span>
        <button onClick={help}>
          A little help getting started <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
function Stat({
  title,
  value,
  detail,
  icon,
  color,
}: {
  title: string;
  value: number;
  detail: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="stat-card">
      <div>
        <span>{title}</span>
        <span className={"stat-icon " + color}>{icon}</span>
      </div>
      <strong>{value.toLocaleString()}</strong>
      <small>
        <span className="dot green" />
        {detail}
      </small>
    </div>
  );
}
function Step({
  number,
  done,
  title,
  text,
  action,
  onClick,
}: {
  number: string;
  done: boolean;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="setup-step">
      <span className={"step-number " + (done ? "done" : "")}>
        {done ? <Check size={18} /> : number}
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <button onClick={onClick}>
        {action}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
