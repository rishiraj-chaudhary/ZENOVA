/** Shared 1–5 scale used for check-ins and before/after session ratings. */
export const MOOD_OPTIONS = [
  { value: 1, label: "Awful", emoji: "😞" },
  { value: 2, label: "Low", emoji: "😔" },
  { value: 3, label: "Okay", emoji: "😐" },
  { value: 4, label: "Good", emoji: "🙂" },
  { value: 5, label: "Great", emoji: "😄" },
];

/**
 * Native radios in a fieldset, which is what gives arrow-key navigation and
 * group semantics for free. The wrapper also carried role="radiogroup", which
 * sits inside the fieldset and announces the group a second time.
 *
 * The legend takes the actual question rather than a fixed one: "How are you
 * feeling?" is wrong for the after-rating, and a screen reader user gets only
 * the legend.
 */
const MoodScale = ({
  value,
  onChange,
  name = "mood",
  disabled = false,
  legend = "How are you feeling?",
}) => (
  <fieldset disabled={disabled} className="border-0 p-0">
    <legend className="sr-only">{legend}</legend>

    <div className="flex flex-wrap justify-center gap-2">
      {MOOD_OPTIONS.map((option) => {
        const selected = value === option.value;

        return (
          <label
            key={option.value}
            className={`flex min-w-[68px] cursor-pointer flex-col items-center gap-1 rounded-2xl border px-3 py-3 transition-all focus-within:ring-2 focus-within:ring-indigo-400 ${
              selected
                ? "border-indigo-400 bg-indigo-500/20 scale-105"
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
            <span className="text-2xl" aria-hidden="true">
              {option.emoji}
            </span>
            <span className="text-xs font-medium text-gray-200">{option.label}</span>
          </label>
        );
      })}
    </div>
  </fieldset>
);

export default MoodScale;
