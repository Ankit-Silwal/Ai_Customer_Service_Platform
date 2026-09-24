import { useCallback, useEffect, useState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import type { Bot } from "@relay/contracts";
import Chat from "./Chat";
import { api, post } from "./api";
export default function PublicChat({ publicId }: { publicId: string }) {
  const [bot, setBot] = useState<Pick<
      Bot,
      "name" | "color" | "greeting"
    > | null>(null),
    [chatId, setChatId] = useState<string | null>(() =>
      sessionStorage.getItem("relay-chat-" + publicId),
    ),
    [error, setError] = useState("");
  const showError = useCallback((text: string) => setError(text), []);
  useEffect(() => {
    void api<Bot>("/public/bots/" + publicId)
      .then(setBot)
      .catch((e) => setError((e as Error).message));
  }, [publicId]);
  async function create() {
    const chat = await post<{ id: string }>(
      "/public/bots/" + publicId + "/conversations",
    );
    setChatId(chat.id);
    sessionStorage.setItem("relay-chat-" + publicId, chat.id);
    setError("");
    return chat.id;
  }
  return (
    <div className="public-page">
      <a className="brand" href="/">
        <span className="brand-mark">
          <MessageCircle size={22} />
        </span>
        relay<span className="brand-period">.</span>
      </a>
      <div className="public-intro">
        <span className="eyebrow purple">A LITTLE HELP, RIGHT HERE.</span>
        <h1>{bot ? "Welcome to " + bot.name : "Let’s get you some help."}</h1>
        <p>
          Good answers. A friendly conversation. A person when you need one.
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          {bot && (
            <button
              className="button small"
              onClick={() =>
                void create().catch((e) => showError((e as Error).message))
              }
            >
              Start fresh
            </button>
          )}
        </div>
      )}
      {bot && (
        <Chat
          bot={bot}
          chatId={chatId}
          onNew={create}
          visitor
          onError={showError}
        />
      )}
      <p className="public-note">
        <ShieldCheck size={14} /> This conversation is private to you and the
        support team.
      </p>
    </div>
  );
}
