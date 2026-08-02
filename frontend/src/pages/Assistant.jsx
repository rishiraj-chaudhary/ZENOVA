import { useEffect, useRef, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import PendingActionCard from "../components/chat/PendingActionCard.jsx";
import useAssistant from "../hooks/useAssistant.js";

/**
 * The assistant: a conversation that can read the user's own measured history
 * and make changes, with their agreement.
 *
 * Distinct from the recommendation chat, which is a single-shot mood-to-music
 * request. This one holds a transcript, calls tools, cites what it says, and
 * has to ask before it does anything.
 */
const SUGGESTIONS = [
  "What has actually worked for me when I'm low?",
  "How has my mood been this month?",
  "What time of day is hardest for me?",
];

const Assistant = () => {
  const {
    turns,
    pendingActions,
    thinking,
    loading,
    error,
    notice,
    send,
    respondToAction,
    clear,
  } = useAssistant();

  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, pendingActions, thinking]);

  const submit = (event) => {
    event.preventDefault();
    send(input);
    setInput("");
  };

  return (
    <div className="flex h-viewport flex-col bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">Assistant</h1>
          <p className="truncate text-xs text-gray-400">
            Knows your measured history. Asks before it changes anything.
          </p>
        </div>

        {turns.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Clear
          </button>
        )}
      </header>

      <div className="scroll-area flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          {loading && <p className="text-sm text-gray-400">Loading…</p>}

          {!loading && turns.length === 0 && (
            <div className="mt-8 text-center">
              <p className="mx-auto max-w-md text-sm text-gray-400">
                Ask about your own patterns. The answers come from your measured
                sessions, and anything it can&apos;t back up it won&apos;t say.
              </p>

              <div className="mt-5 flex flex-col items-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-gray-200 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => (
            <div
              key={`${turn.at ?? "t"}-${index}`}
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                turn.role === "user"
                  ? "self-end bg-indigo-600 text-white"
                  : "self-start bg-white/10 text-gray-100"
              }`}
            >
              {turn.content}
            </div>
          ))}

          {pendingActions.map((action) => (
            <PendingActionCard
              key={action.token}
              action={action}
              onRespond={respondToAction}
            />
          ))}

          {thinking && (
            <p className="self-start rounded-2xl bg-white/10 px-4 py-2.5 text-sm text-gray-400">
              Thinking…
            </p>
          )}

          {notice && (
            <p className="rounded-xl bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
              {notice}
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-500/10 px-4 py-2 text-xs text-red-200"
            >
              {error}
            </p>
          )}

          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={submit} className="border-t border-white/10 px-4 py-3">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your patterns…"
            aria-label="Message the assistant"
            className="flex-1 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={thinking || !input.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

const AssistantPage = () => (
  <ErrorBoundary label="the assistant">
    <Assistant />
  </ErrorBoundary>
);

export default AssistantPage;
