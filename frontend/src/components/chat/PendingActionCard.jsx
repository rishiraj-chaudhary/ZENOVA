import { useState } from "react";

/**
 * A change the assistant wants to make, waiting for the person to agree.
 *
 * The summary is generated server-side from the actual arguments rather than
 * from the model's description of them — a model could describe one thing while
 * the arguments do another, and what someone agrees to has to be what happens.
 */
const PendingActionCard = ({ action, onRespond }) => {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const respond = async (accept) => {
    setBusy(true);
    try {
      const result = await onRespond({ token: action.token, accept });
      setOutcome(accept && result?.performed ? "done" : "declined");
    } catch (error) {
      setOutcome(error.message);
    } finally {
      setBusy(false);
    }
  };

  if (outcome === "done") {
    return (
      <p className="rounded-xl bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
        <i className="fa-solid fa-check mr-1.5" aria-hidden="true" />
        {action.summary}
      </p>
    );
  }

  if (outcome === "declined") {
    return (
      <p className="rounded-xl bg-white/5 px-4 py-2 text-xs text-gray-400">
        Not done — {action.summary.toLowerCase()}
      </p>
    );
  }

  const destructive = action.sideEffect === "destructive";

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        destructive ? "border-red-500/40 bg-red-500/10" : "border-white/15 bg-white/5"
      }`}
    >
      <p className="text-sm text-white">
        {destructive && (
          <i className="fa-solid fa-triangle-exclamation mr-1.5 text-red-300" aria-hidden="true" />
        )}
        {action.summary}?
      </p>

      {outcome && outcome !== "done" && outcome !== "declined" && (
        <p role="alert" className="mt-1.5 text-xs text-red-300">
          {outcome}
        </p>
      )}

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(true)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 ${
            destructive ? "bg-red-600 hover:bg-red-500" : "bg-indigo-600 hover:bg-indigo-500"
          }`}
        >
          {destructive ? "Yes, delete it" : "Do it"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => respond(false)}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          No
        </button>
      </div>
    </div>
  );
};

export default PendingActionCard;
