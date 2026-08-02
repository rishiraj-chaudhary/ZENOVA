import { useEffect, useState } from "react";
import ErrorBoundary from "../components/ErrorBoundary.jsx";
import StepCard from "../components/plan/StepCard.jsx";
import * as planAPI from "../api/planAPI.js";
import usePlan from "../hooks/usePlan.js";

/**
 * A listening plan: a structure for using the app over a few weeks, with
 * measurement attached.
 *
 * Deliberately not a streak and deliberately not a programme. Missed days are
 * neutral and silent, stopping is one tap with no persuasion, and adherence is
 * never presented as the thing that matters — the numbers that matter are
 * whether anything actually moved.
 */

const DURATION_LABELS = { 7: "1 week", 14: "2 weeks", 28: "4 weeks" };

const Setup = ({ onStarted }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [durations, setDurations] = useState([]);
  const [direction, setDirection] = useState(null);
  const [durationDays, setDurationDays] = useState(14);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    planAPI
      .fetchDirections()
      .then((result) => {
        setSuggestions(result.suggestions ?? []);
        setAnalysis(result.analysis ?? null);
        setDurations(result.durations ?? []);
        // Pre-select what the data argues for; they can still pick anything.
        if (result.suggestions?.[0]?.fromData) setDirection(result.suggestions[0].key);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  useEffect(() => {
    if (!direction) return;

    setPreview(null);
    planAPI
      .previewPlan({ direction, durationDays })
      .then(setPreview)
      .catch((previewError) => setError(previewError.message));
  }, [direction, durationDays]);

  const start = async () => {
    setBusy(true);
    try {
      await onStarted({ direction, durationDays });
    } catch (startError) {
      setError(startError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-white">Start a plan</h1>
      <p className="mt-1.5 text-sm text-gray-400">
        A few sessions a week, aimed at something specific, with the results
        measured rather than guessed at.
      </p>

      {/* What their own data says, before asking them to choose. A bare list of
          four options asks the user to diagnose themselves. */}
      {analysis?.enough && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-300">
          Looking at your last {analysis.samples} check-ins
          {analysis.hardestBand ? `, your ${analysis.hardestBand}s stand out` : ""} — here&apos;s
          what we&apos;d suggest, strongest first.
        </p>
      )}

      {analysis && !analysis.enough && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-400">
          There aren&apos;t enough check-ins yet to suggest anything from your own
          data, so pick whichever of these sounds closest.
        </p>
      )}

      <fieldset className="mt-8 border-0 p-0">
        <legend className="text-xs font-medium uppercase tracking-wider text-gray-500">
          What are you after
        </legend>

        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((option) => (
            <label
              key={option.key}
              className={`cursor-pointer rounded-2xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                direction === option.key
                  ? "border-indigo-400 bg-indigo-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="direction"
                value={option.key}
                checked={direction === option.key}
                onChange={() => setDirection(option.key)}
                className="sr-only"
              />

              <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
                {option.label}
                {option.fromData && (
                  <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider text-emerald-300">
                    from your data
                  </span>
                )}
              </span>

              {/* The reason is the part they read; the score is only a ranking
                  device. */}
              <span className="mt-1 block text-sm text-gray-400">{option.reason}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6 border-0 p-0">
        <legend className="text-xs font-medium uppercase tracking-wider text-gray-500">
          How long
        </legend>

        <div className="mt-3 flex flex-wrap gap-2">
          {durations.map((days) => (
            <label
              key={days}
              className={`cursor-pointer rounded-xl border px-4 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-indigo-400 ${
                durationDays === days
                  ? "border-indigo-400 bg-indigo-500/20 text-white"
                  : "border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
              }`}
            >
              <input
                type="radio"
                name="duration"
                value={days}
                checked={durationDays === days}
                onChange={() => setDurationDays(days)}
                className="sr-only"
              />
              {DURATION_LABELS[days] ?? `${days} days`}
            </label>
          ))}
        </div>
      </fieldset>

      {preview && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold text-white">What this asks for</h2>

          <p className="mt-2 text-sm text-gray-300">
            {preview.sessionCount} sessions and {preview.restCount} rest days over{" "}
            {DURATION_LABELS[preview.durationDays]}, around{" "}
            {String(preview.scheduleHour).padStart(2, "0")}:00 — that&apos;s when you
            tend to listen.
          </p>

          {/* Where the target came from, rather than just asserting a number. */}
          {preview.target?.basis === "personal_best_week" ? (
            <p className="mt-3 text-sm text-gray-400">
              Your best week averaged{" "}
              <strong className="text-white">
                {preview.target.evidence.bestWeekMean}
              </strong>
              . Right now you&apos;re around{" "}
              <strong className="text-white">
                {preview.target.evidence.currentMean}
              </strong>
              . This aims at{" "}
              <strong className="text-emerald-300">{preview.target.valence}</strong> —
              most of the way back to somewhere you&apos;ve actually been.
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-400">
              There isn&apos;t enough history yet to set a target from your own
              range, so this starts with a modest one and adjusts as it learns.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!direction || busy}
        onClick={start}
        className="mt-6 w-full rounded-xl bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {busy ? "Starting…" : "Start this plan"}
      </button>
    </div>
  );
};

const StepDot = ({ step }) => {
  const style =
    step.status === "done"
      ? "bg-emerald-500 border-emerald-400"
      : step.kind === "rest"
        ? "bg-transparent border-white/15"
        : step.status === "missed"
          ? "bg-white/10 border-white/20"
          : "bg-white/5 border-white/25";

  const label =
    step.kind === "rest"
      ? "Rest day"
      : step.status === "done"
        ? "Session done"
        : step.status === "missed"
          ? "Session not done"
          : "Session";

  return (
    <div
      className={`h-6 w-6 rounded-full border-2 ${style}`}
      title={`Day ${step.dayIndex + 1} — ${label}`}
      aria-label={`Day ${step.dayIndex + 1}, ${label}`}
    />
  );
};

const Active = ({ plan, steps, nextStep, behaviour, onPause, onResume, onStop, onStepDone }) => {
  const [readout, setReadout] = useState(null);

  useEffect(() => {
    planAPI.fetchReadout().then(setReadout).catch(() => {});
  }, [plan.status]);

  const latestAdaptation = plan.adaptations?.at(-1);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            {readout?.label ?? "Your plan"}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Day {Math.min((readout?.daysRun ?? 0) + 1, plan.durationDays)} of{" "}
            {plan.durationDays}
            {plan.status === "paused" && " · paused"}
          </p>
        </div>

        <div className="flex gap-2">
          {plan.status === "active" ? (
            <button
              type="button"
              onClick={onPause}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10"
            >
              Pause
            </button>
          ) : (
            <button
              type="button"
              onClick={onResume}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-indigo-500"
            >
              Resume
            </button>
          )}

          {/* One tap. No "are you sure you want to give up". */}
          <button
            type="button"
            onClick={onStop}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            End plan
          </button>
        </div>
      </div>

      {/* Anything the plan changed about itself, in its own words. */}
      {latestAdaptation && (
        <p className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
          {latestAdaptation.change}
        </p>
      )}

      {nextStep && plan.status === "active" && (
        <div className="mt-6">
          <StepCard step={nextStep} onDone={onStepDone} />
        </div>
      )}

      <div className="mt-8">
        <p className="text-xs uppercase tracking-wider text-gray-500">The days</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {steps.map((step) => (
            <StepDot key={step.dayIndex} step={step} />
          ))}
        </div>
      </div>

      {/* Two separate questions, never merged into one number. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            Sessions done
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
            {behaviour?.adherence?.done ?? 0}
            <span className="text-base font-normal text-gray-500">
              {" "}
              of {behaviour?.adherence?.due ?? 0} due
            </span>
          </p>
          <p className="mt-1.5 text-xs text-gray-500">
            Missed days are fine. They get moved, not counted against you.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            What changed
          </p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {readout?.effect?.headline?.text ?? "—"}
          </p>
          <p className="mt-1.5 text-xs text-gray-500">
            {readout?.effect?.headline?.provisional
              ? "Not enough sessions yet to say for sure."
              : `Across ${readout?.effect?.headline?.samples ?? 0} measured sessions.`}
          </p>
        </div>
      </div>
    </div>
  );
};

const Plan = () => {
  const {
    plan,
    steps,
    nextStep,
    behaviour,
    loading,
    error,
    refresh,
    start,
    pause,
    resume,
    stop,
  } = usePlan();

  if (loading) {
    return (
      <div className="flex min-h-viewport items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <main className="min-h-viewport bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white">
      {error && (
        <p role="alert" className="mx-auto max-w-2xl px-4 pt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {plan ? (
        <Active
          plan={plan}
          steps={steps}
          nextStep={nextStep}
          behaviour={behaviour}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          onStepDone={refresh}
        />
      ) : (
        <Setup onStarted={start} />
      )}
    </main>
  );
};

const PlanPage = () => (
  <ErrorBoundary label="your plan">
    <Plan />
  </ErrorBoundary>
);

export default PlanPage;
