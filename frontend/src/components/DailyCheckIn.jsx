import { useState } from "react";
import { logMood } from "../api/wellbeingAPI.js";
import MoodScale, { MOOD_OPTIONS } from "./MoodScale.jsx";

const STORAGE_KEY = "lastCheckInDate";
const today = () => new Date().toISOString().slice(0, 10);

export const hasCheckedInToday = () => localStorage.getItem(STORAGE_KEY) === today();

/**
 * The 5-second daily habit loop.
 *
 * Mood was previously only inferred from chat messages, so a user who did not
 * type anything left no trace and the Patterns page stayed empty. One tap a day
 * is what makes the longitudinal view worth opening.
 */
const DailyCheckIn = ({ onDone }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (value) => {
    setSaving(true);
    setError(null);

    try {
      await logMood({
        mood: MOOD_OPTIONS.find((option) => option.value === value).label.toLowerCase(),
        intensity: value,
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
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
      <h2 className="text-lg font-semibold text-white">How are you today?</h2>
      <p className="mt-1 text-sm text-gray-400">One tap. It builds your Patterns view.</p>

      <div className="mt-5">
        <MoodScale value={null} onChange={submit} name="daily" disabled={saving} />
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onDone}
        className="mt-4 text-xs text-gray-500 underline-offset-2 hover:text-gray-300 hover:underline"
      >
        Not now
      </button>
    </section>
  );
};

export default DailyCheckIn;
