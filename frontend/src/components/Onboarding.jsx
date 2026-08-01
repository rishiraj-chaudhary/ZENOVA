import { useState } from "react";
import { completeOnboarding } from "../api/userAPI.js";

const GENRE_OPTIONS = [
  "Lo-fi", "Classical", "Indie", "Hip-Hop", "Rock", "Pop",
  "Ambient", "Jazz", "Electronic", "Folk", "R&B", "Metal",
];

const GOAL_OPTIONS = [
  { id: "focus", label: "Focus while I work or study", icon: "fa-bullseye" },
  { id: "unwind", label: "Wind down and relax", icon: "fa-moon" },
  { id: "lift", label: "Lift my mood", icon: "fa-sun" },
  { id: "process", label: "Sit with how I feel", icon: "fa-heart" },
];

const toggle = (list, value) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

/**
 * Three-step intro shown once.
 *
 * New users previously landed on an empty chat with no explanation of what the
 * app did or what to type. The consent step is here rather than buried in
 * settings because mood history cannot be recorded without it.
 */
const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [genres, setGenres] = useState([]);
  const [goals, setGoals] = useState([]);
  // Unticked by default: consent to storing health data should be an action
  // the user takes, not one they fail to undo.
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const finish = async () => {
    setSaving(true);
    setError(null);

    try {
      const profile = await completeOnboarding({
        preferences: [...genres, ...goals],
        moodTrackingConsent: consent,
      });
      onComplete(profile);
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
  };

  const steps = [
    {
      title: "What do you listen to?",
      subtitle: "Pick a few. This shapes your first recommendations.",
      canAdvance: genres.length > 0,
      content: (
        <div className="flex flex-wrap justify-center gap-2">
          {GENRE_OPTIONS.map((genre) => (
            <button
              key={genre}
              type="button"
              aria-pressed={genres.includes(genre)}
              onClick={() => setGenres((current) => toggle(current, genre))}
              className={`rounded-full border px-4 py-2 text-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                genres.includes(genre)
                  ? "border-indigo-400 bg-indigo-500/25 text-white"
                  : "border-white/15 bg-white/5 text-gray-300 hover:bg-white/10"
              }`}
            >
              {genre}
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "What do you usually want from music?",
      subtitle: "You can change this later.",
      canAdvance: goals.length > 0,
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          {GOAL_OPTIONS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              aria-pressed={goals.includes(goal.id)}
              onClick={() => setGoals((current) => toggle(current, goal.id))}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                goals.includes(goal.id)
                  ? "border-indigo-400 bg-indigo-500/20"
                  : "border-white/15 bg-white/5 hover:bg-white/10"
              }`}
            >
              <i className={`fa-solid ${goal.icon} text-indigo-300`} aria-hidden="true" />
              <span className="text-sm">{goal.label}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      title: "One thing before we start",
      subtitle: null,
      canAdvance: true,
      content: (
        <div className="space-y-4 text-left">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-950/20 p-4">
            <p className="text-sm text-amber-100">
              <strong>ZENOVA is not therapy and not a medical service.</strong> It suggests
              music based on how you describe your mood. It cannot diagnose or treat
              anything, and it is not a substitute for professional care.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4 focus-within:ring-2 focus-within:ring-indigo-400">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 h-4 w-4 accent-indigo-500"
            />
            <span className="text-sm text-gray-300">
              Save my mood check-ins so I can see my patterns over time.
              <span className="mt-1 block text-xs text-gray-500">
                Optional. Without this the app still works, but the Patterns page stays
                empty. You can export or delete this data at any time in Settings.
              </span>
            </span>
          </label>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLastStep = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 sm:p-8">
        <div className="mb-6 flex gap-1.5" aria-hidden="true">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= step ? "bg-indigo-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        <h1 className="text-2xl font-bold text-white">{current.title}</h1>
        {current.subtitle && (
          <p className="mt-1 text-sm text-gray-400">{current.subtitle}</p>
        )}

        <div className="my-6">{current.content}</div>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="text-sm text-gray-400 hover:text-white disabled:invisible"
          >
            Back
          </button>

          <button
            type="button"
            disabled={!current.canAdvance || saving}
            onClick={() => (isLastStep ? finish() : setStep((s) => s + 1))}
            className="rounded-full bg-indigo-500 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
          >
            {saving ? "Setting up…" : isLastStep ? "Start listening" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
