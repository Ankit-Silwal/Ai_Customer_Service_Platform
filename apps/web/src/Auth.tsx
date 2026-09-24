import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Headphones,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { post } from "./api";
export default function Auth({
  onSuccess,
}: {
  onSuccess: () => Promise<void>;
}) {
  const [register, setRegister] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(form: HTMLFormElement) {
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(form));
    try {
      await post("/auth/" + (register ? "register" : "login"), data);
      await onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/">
          <span className="brand-mark">
            <MessageCircle size={23} />
          </span>
          relay<span className="brand-period">.</span>
        </a>
        <div className="auth-story-content">
          <span className="eyebrow">
            <span className="dot green" /> AI-powered. People-centered.
          </span>
          <h1>
            Great support.
            <br />A little more
            <br />
            <em>human.</em>
          </h1>
          <p>
            Turn what your company knows into answers your customers love. With
            your team, always one conversation away.
          </p>
          <div className="auth-features">
            <span>
              <BookOpen size={17} /> Your knowledge, connected
            </span>
            <span>
              <Sparkles size={17} /> Answers with sources
            </span>
            <span>
              <Headphones size={17} /> A human when it matters
            </span>
          </div>
          <div className="story-chat">
            <div className="story-chat-title">
              <span className="mini-logo">
                <Sparkles size={16} />
              </span>
              <strong>Your support, in sync</strong>
              <span className="badge green">Always connected</span>
            </div>
            <div className="story-question">
              Can I return something that isn't quite right?
            </div>
            <div className="story-answer">
              Of course. You have 30 days to send it back. I can help you find
              the next step.
              <small>
                <BookOpen size={12} /> Returns & refunds · Page 1
              </small>
            </div>
            <div className="story-human">
              <span className="avatar peach">J</span>
              <span>Your team can pick up right here.</span>
              <Check size={15} />
            </div>
            <span className="illustration-label">
              An example of the experience you can build
            </span>
          </div>
        </div>
        <div className="auth-copyright">Built for better conversations.</div>
      </section>
      <section className="auth-form-side">
        <div className="auth-switch">
          {register ? "Already part of the conversation?" : "New to Relay?"}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Create an account"}{" "}
            <ArrowRight size={14} />
          </button>
        </div>
        <div className="auth-form-wrap">
          <div className="section-icon">
            <Sparkles size={23} />
          </div>
          <span className="eyebrow purple">YOUR NEXT CHAPTER IN SUPPORT</span>
          <h2>{register ? "Make yourself at home." : "Welcome back."}</h2>
          <p>
            {register
              ? "A home for your knowledge. A helping hand for your customers."
              : "Your customers and teammates are right where you left them."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(e.currentTarget);
            }}
          >
            {register && (
              <>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <label>
                  Company name
                  <input
                    name="company"
                    autoComplete="organization"
                    placeholder="Your company"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
              </>
            )}
            <label>
              Work email
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                placeholder="At least 12 characters"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Getting things ready…"
                : register
                  ? "Create your workspace"
                  : "Sign in to your workspace"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="auth-note">
            <Check size={14} /> Private company workspace <span>·</span> No
            credit card needed
          </div>
        </div>
        <div className="auth-bottom">
          Your knowledge stays in your workspace. Your customers stay in the
          conversation.
        </div>
      </section>
    </div>
  );
}
