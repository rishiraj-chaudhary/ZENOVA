import { useState } from "react";
import { logMood } from "../api/wellbeingAPI.js";
import Modal from "./Modal.jsx";
import AffectGrid from "./AffectGrid.jsx";
import { MOOD_OPTIONS } from "./MoodScale.jsx";

const STORAGE_KEY = "lastCheckInDate";
const today = () => new Date().toISOString().slice(0, 10);

export const hasCheckedInToday = () => localStorage.getItem(STORAGE_KEY) === today();

/**
 * The 5-second daily habit loop, asked once a day as a dialog.
 *
 * Mood was previously only inferred from chat messages, so a user who did not
 * type anything left no trace and the Patterns page stayed empty. One tap a day
 * is what makes the longitudinal view worth opening.
 *
 * It sits in a modal rather than inline above the chat: inline it pushed the
 * whole conversation down the page on every visit, and it was easy to scroll
 * past without answering — which is the one thing this is for.
 */
const DailyCheckIn = ({ open = true, onDone }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async ({ valence, arousal }) => {
    setSaving(true);
    setError(null);

    try {
      await logMood({
        mood: MOOD_OPTIONS.find((option) => option.value === valence).label.toLowerCase(),
        intensity: valence,
        // Optional second axis. Sent only when given, so a partial reading is
        // recorded rather than refused.
        ...(arousal ? { arousal } : {}),
      });
      localStorage.setItem(STORAGE_KEY, today());
      onDone?.();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onDone} labelledBy="daily-check-in-title">
      <section className="p-6 text-center sm:p-8">
        <h2 id="daily-check-in-title" className="text-xl font-semibold text-white">
          How are you today?
        </h2>
        <p className="mt-1.5 text-sm text-gray-400">
          One tap. It builds your Patterns view.
        </p>

        <div className="mt-6">
          <AffectGrid onSubmit={submit} disabled={saving} submitLabel="Save check-in" />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onDone}
          className="mt-6 rounded-lg px-3 py-1.5 text-xs text-gray-500 underline-offset-2 transition-colors hover:text-gray-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Not now
        </button>
      </section>
    </Modal>
  );
};

export default DailyCheckIn;
