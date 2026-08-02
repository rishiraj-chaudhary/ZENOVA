import { useState } from "react";

/**
 * A two-dimensional mood reading: how good, and how activated.
 *
 * A single 1–5 scale cannot tell "I need to be calmer" from "I need more
 * energy" — opposite prescriptions that produce identical input. Music maps
 * onto arousal far more naturally than onto a single goodness axis, so this is
 * the difference between a recommender that can act on the request and one that
 * has to guess.
 *
 * Built as two labelled radio groups rather than a draggable 5×5 pad. A pad is
 * prettier and is a genuinely hard control to operate with a keyboard or a
 * screen reader; two rows of radios are neither, and this is the most-used
 * input in the product.
 */
const VALENCE = [
  { value: 1, label: "Awful", emoji: "😞" },
  { value: 2, label: "Low", emoji: "😔" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😄" },
];

const AROUSAL = [
  { value: 1, label: "Drained", emoji: "🥱" },
  { value: 2, label: "Sluggish", emoji: "😪" },
  { value: 3, label: "Steady", emoji: "😌" },
  { value: 4, label: "Restless", emoji: "😬" },
  { value: 5, label: "Wired", emoji: "😰" },
];

const Row = ({ options, value, onChange, name, legend, hint, disabled }) => (
  <fieldset disabled={disabled} className="border-0 p-0">
    <legend className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-400">
      {legend}
      <span className="ml-2 normal-case tracking-normal text-gray-500">{hint}</span>
    </legend>

    <div className="flex flex-wrap justify-center gap-2">
      {options.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={`flex min-w-[62px] cursor-pointer flex-col items-center gap-1 rounded-2xl border px-2.5 py-2.5 transition-all focus-within:ring-2 focus-within:ring-indigo-400 ${
              selected
                ? "scale-105 border-indigo-400 bg-indigo-500/20"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            } ${disabled ? "opacity-50" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="text-xl" aria-hidden="true">
              {option.emoji}
            </span>
            <span className="text-[0.7rem] font-medium text-gray-200">{option.label}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

const AffectGrid = ({ onSubmit, disabled = false, submitLabel = "Save" }) => {
  const [valence, setValence] = useState(null);
  const [arousal, setArousal] = useState(null);

  return (
    <div className="flex flex-col gap-5">
      <Row
        options={VALENCE}
        value={valence}
        onChange={setValence}
        name="valence"
        legend="How good or bad"
        hint="the way most apps ask"
        disabled={disabled}
      />

      <Row
        options={AROUSAL}
        value={arousal}
        onChange={setArousal}
        name="arousal"
        legend="How much energy"
        hint="this is what picks the music"
        disabled={disabled}
      />

      <button
        type="button"
        disabled={disabled || valence === null}
        onClick={() => onSubmit({ valence, arousal })}
        className="mx-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {submitLabel}
      </button>

      {valence !== null && arousal === null && (
        // Energy is optional rather than required: a partial reading is still
        // worth recording, and the ledger keeps the two cells separate anyway.
        <p className="text-center text-xs text-gray-500">
          Energy is optional — but it&apos;s what tells us whether to calm you down
          or wake you up.
        </p>
      )}
    </div>
  );
};

export { AROUSAL, VALENCE };
export default AffectGrid;
