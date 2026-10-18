import { useState, type ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Dialog } from "@repo/ui/dialog";
import type { DeliveryOrder } from "@relay/contracts";
import { post } from "./api";
import { money } from "./delivery-format";
export function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <div className="d-metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
export function RefundResult({ order }: { order: DeliveryOrder }) {
  const r = order.refund!;
  return (
    <div className="refund-result">
      <div>
        <Sparkles size={16} />
        <strong>
          {r.assessment === "eligible"
            ? "Eligible under policy"
            : r.assessment === "ineligible"
              ? "Outside standard policy"
              : "A teammate should review"}
        </strong>
        <span>{r.status}</span>
      </div>
      <p>{r.explanation}</p>
      <small>
        {r.assessment === "review"
          ? "Maximum review amount"
          : "Eligible amount"}
        : <b>{money(r.amount_cents)}</b> · No automatic payment
      </small>
      <details>
        <summary>
          {r.ai_mode === "ai"
            ? "AI policy explanation"
            : r.ai_mode === "preview"
              ? "Policy source preview"
              : "Policy explanation unavailable"}
        </summary>
        <p>
          {r.ai_content ||
            "The explanation is being prepared. Your rule check is saved."}
        </p>
        {r.citations.map((c, i) => (
          <blockquote key={i}>
            <strong>
              {c.name} · Page {c.page}
            </strong>
            <p>{c.excerpt}</p>
          </blockquote>
        ))}
      </details>
      {r.decision_note && (
        <p className="decision-note">
          <b>Team note:</b> {r.decision_note}
        </p>
      )}
    </div>
  );
}
export function DeliveryAuth({
  path,
  onClose,
  onSuccess,
}: {
  path: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [signup, setSignup] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      title={
        signup ? "Your good-food era starts here" : "Welcome back to the table"
      }
      onClose={onClose}
      className="delivery-dialog"
    >
      <p className="dialog-lead">
        One account for your orders, delivery updates, and support.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          void (async () => {
            if (signup)
              await post(path + "/register", {
                name: data.get("name"),
                email: data.get("email"),
                password: data.get("password"),
              });
            else {
              await post("/auth/login", {
                email: data.get("email"),
                password: data.get("password"),
              });
              await post(path + "/join");
            }
            await onSuccess();
          })()
            .catch((e) => setError((e as Error).message))
            .finally(() => setBusy(false));
        }}
      >
        {signup && (
          <label>
            Your name
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email address
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        {signup && <small>Use at least 12 characters.</small>}
        {error && (
          <p role="alert" className="d-error">
            {error}
          </p>
        )}
        <button className="d-button d-primary full" disabled={busy}>
          {busy
            ? "One moment…"
            : signup
              ? "Create customer account"
              : "Sign in"}
          <ArrowRight size={17} />
        </button>
      </form>
      <button
        className="d-text-link"
        onClick={() => {
          setSignup(!signup);
          setError("");
        }}
      >
        {signup
          ? "Already have an account? Sign in"
          : "New here? Create an account"}
      </button>
    </Dialog>
  );
}
