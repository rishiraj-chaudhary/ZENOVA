import { useState } from "react";
import * as wellbeingAPI from "../api/wellbeingAPI.js";

/**
 * Like / skip controls on a recommended song.
 *
 * These are what make personalization real. The recommendation prompt has
 * always read the user's liked and skipped genres, but nothing ever produced
 * them — so every request was generated as though the user had no history.
 *
 * Optimistic: the signal is advisory, so a failed write reverts quietly rather
 * than interrupting listening with an error.
 */
const SongFeedback = ({ musicId, sessionId, moodAtTime, initialSignal = null }) => {
  const [signal, setSignal] = useState(initialSignal);
  const [pending, setPending] = useState(false);

  const send = async (nextSignal) => {
    const previous = signal;
    const clearing = signal === nextSignal;

    setSignal(clearing ? null : nextSignal);
    setPending(true);

    try {
      if (clearing) {
        await wellbeingAPI.clearFeedback(musicId);
      } else {
        await wellbeingAPI.submitFeedback({
          musicId,
          signal: nextSignal,
          sessionId,
          moodAtTime,
        });
      }
    } catch {
      setSignal(previous);
    } finally {
      setPending(false);
    }
  };

  const buttonClass = (active, activeColor) =>
    `flex h-8 w-8 items-center justify-center rounded-full border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
      active
        ? `${activeColor} border-transparent text-white`
        : "border-white/20 bg-white/5 text-gray-300 hover:bg-white/15"
    } ${pending ? "opacity-60" : ""}`;

  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => send("liked")}
        aria-pressed={signal === "liked"}
        aria-label="More like this"
        title="More like this"
        className={buttonClass(signal === "liked", "bg-emerald-500")}
      >
        <i className="fa-solid fa-thumbs-up text-xs" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => send("skipped")}
        aria-pressed={signal === "skipped"}
        aria-label="Not for me"
        title="Not for me — don't suggest this again"
        className={buttonClass(signal === "skipped", "bg-rose-500")}
      >
        <i className="fa-solid fa-thumbs-down text-xs" aria-hidden="true" />
      </button>
    </div>
  );
};

export default SongFeedback;
