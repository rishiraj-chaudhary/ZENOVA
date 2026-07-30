import { useState } from "react";
import * as wellbeingAPI from "../api/wellbeingAPI.js";
import MoodScale from "./MoodScale.jsx";

/**
 * The before/after prompt that turns a recommendation into a measured outcome.
 *
 * This is the only place the product learns whether the music actually helped,
 * so it is deliberately a single tap and skippable — a prompt people dismiss is
 * worth less than one they answer.
 */
const SessionCheckIn = ({ sessionId, phase, onComplete, onSkip }) => {
  const [rating, setRating] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isBefore = phase === "before";

  const submit = async (value) => {
    setRating(value);
    setSubmitting(true);
    setError(null);

    try {
      if (isBefore) {
        await wellbeingAPI.startSession({ sessionId, moodBefore: value });
      } else {
        await wellbeingAPI.completeSession({ sessionId, moodAfter: value });
      }
      onComplete?.(value);
    } catch (submitError) {
      setError(submitError.message);
      setRating(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="my-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
      <h2 className="text-sm font-medium text-gray-200">
        {isBefore ? "Before you listen — how are you feeling?" : "Did that help?"}
      </h2>

      <div className="mt-4">
        <MoodScale
          value={rating}
          onChange={submit}
          name={`session-${phase}`}
          disabled={submitting}
        />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-xs text-red-300">
          {error}
        </p>
      )}

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
        >
          Skip
        </button>
      )}
    </section>
  );
};

export default SessionCheckIn;
