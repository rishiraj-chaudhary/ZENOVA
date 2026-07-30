/**
 * Shown whenever the backend flags risk in a message.
 *
 * Deliberately high-contrast and un-dismissable-by-accident: this is the one
 * surface in the app that must never be mistaken for decoration. It renders
 * from server-provided resources so helpline data lives in one place.
 */
const CrisisSupport = ({ resources = [], notice, level = "crisis", onDismiss }) => {
  if (resources.length === 0) return null;

  const isCrisis = level === "crisis";

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={`my-4 rounded-2xl border p-5 ${
        isCrisis
          ? "border-amber-400/60 bg-amber-950/40"
          : "border-sky-400/40 bg-sky-950/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <i
            className={`fa-solid fa-hand-holding-heart mt-1 text-lg ${
              isCrisis ? "text-amber-300" : "text-sky-300"
            }`}
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-semibold text-white">
              {isCrisis ? "Support is available right now" : "You don't have to do this alone"}
            </h2>
            <p className="mt-1 text-sm text-gray-300">
              {isCrisis
                ? "Talking to someone can help more than a playlist can. These lines are free and confidential."
                : "If things feel heavy, these free and confidential lines are there whenever you want them."}
            </p>
          </div>
        </div>

        {onDismiss && !isCrisis && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss support information"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <i className="fa-solid fa-times text-sm" aria-hidden="true" />
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-2">
        {resources.map((resource) => (
          <li key={resource.name}>
            <a
              href={resource.url}
              target={resource.url?.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-white/5 px-4 py-3 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <span className="font-semibold text-white">{resource.name}</span>
              <span
                className={`font-mono text-sm ${
                  isCrisis ? "text-amber-200" : "text-sky-200"
                }`}
              >
                {resource.contact}
              </span>
              <span className="w-full text-xs text-gray-400">
                {resource.description}
                {resource.available && ` · ${resource.available}`}
              </span>
            </a>
          </li>
        ))}
      </ul>

      {notice && <p className="mt-3 text-xs text-gray-400">{notice}</p>}
    </section>
  );
};

export default CrisisSupport;
