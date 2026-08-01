import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as wellbeingAPI from "../api/wellbeingAPI.js";
import MoodChart from "../components/MoodChart.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const TREND_STYLES = {
  improving: { icon: "fa-arrow-trend-up", color: "text-emerald-400", label: "Trending up" },
  declining: { icon: "fa-arrow-trend-down", color: "text-amber-400", label: "Trending down" },
  steady: { icon: "fa-arrows-left-right", color: "text-sky-400", label: "Holding steady" },
  // The server says "unknown" when it has too few entries to compare halves.
  // Falling back to `steady` asserted stability the server had declined to
  // claim — the one thing a wellbeing dashboard must not invent.
  unknown: {
    icon: "fa-circle-question",
    color: "text-gray-400",
    label: "Not enough check-ins yet",
  },
};

const StatCard = ({ icon, label, value, hint }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-center gap-2 text-gray-400">
      <i className={`fa-solid ${icon} text-sm`} aria-hidden="true" />
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </div>
);

const Insights = () => {
  const { user } = useAuth();
  const [periodDays, setPeriodDays] = useState(30);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setInsights(await wellbeingAPI.fetchInsights(periodDays));
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    load();
  }, [load]);

  const trend = TREND_STYLES[insights?.trend] ?? TREND_STYLES.unknown;
  const efficacy = insights?.efficacy;

  return (
    <main className="min-h-viewport bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold sm:text-4xl">
            Your patterns{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-2 text-gray-400">
            What your check-ins and listening say, over time.
          </p>
        </header>

        <div
          role="tablist"
          aria-label="Time period"
          className="mb-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1"
        >
          {PERIODS.map((period) => (
            <button
              key={period.days}
              role="tab"
              aria-selected={periodDays === period.days}
              onClick={() => setPeriodDays(period.days)}
              className={`rounded-xl px-4 py-2 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                periodDays === period.days
                  ? "bg-indigo-500 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {loading && <p className="py-16 text-center text-gray-400">Reading your history…</p>}

        {error && (
          <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-center text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && insights && !insights.hasEnoughData && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <i className="fa-solid fa-seedling mb-4 text-4xl text-emerald-400" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Not enough to go on yet</h2>
            <p className="mx-auto mt-2 max-w-md text-gray-400">
              You have {insights.totalEntries} check-in
              {insights.totalEntries === 1 ? "" : "s"} so far. After{" "}
              {insights.minimumEntriesNeeded}, patterns start to show.
            </p>
            <Link
              to="/profile"
              className="mt-6 inline-block rounded-full bg-indigo-500 px-6 py-3 font-medium transition-colors hover:bg-indigo-400"
            >
              Check in now
            </Link>
          </div>
        )}

        {!loading && !error && insights?.hasEnoughData && (
          <div className="space-y-6">
            {insights.narrative && (
              <section className="rounded-3xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/15 to-purple-500/10 p-6">
                <h2 className="text-xl font-semibold">{insights.narrative.headline}</h2>
                <p className="mt-3 text-gray-200">{insights.narrative.summary}</p>

                {insights.narrative.observations?.length > 0 && (
                  <ul className="mt-4 space-y-2">
                    {insights.narrative.observations.map((observation) => (
                      <li key={observation} className="flex gap-2 text-sm text-gray-300">
                        <i
                          className="fa-solid fa-circle-dot mt-1 text-[6px] text-indigo-300"
                          aria-hidden="true"
                        />
                        {observation}
                      </li>
                    ))}
                  </ul>
                )}

                {insights.narrative.suggestion && (
                  <p className="mt-4 rounded-2xl bg-white/5 p-3 text-sm text-gray-200">
                    <span className="font-medium text-indigo-300">Try this: </span>
                    {insights.narrative.suggestion}
                  </p>
                )}
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="mb-4 text-lg font-semibold">Mood over time</h2>
              <MoodChart series={insights.series} />
            </section>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={trend.icon}
                label="Direction"
                value={<span className={trend.color}>{trend.label}</span>}
                hint={`Across ${insights.totalEntries} check-ins`}
              />
              <StatCard
                icon="fa-face-smile"
                label="Most common"
                value={insights.topMoods[0]?.mood ?? "—"}
                hint={`${insights.topMoods[0]?.count ?? 0} times`}
              />
              <StatCard
                icon="fa-calendar-day"
                label="Hardest day"
                value={insights.moodByDayOfWeek.hardest ?? "—"}
                hint={`Easiest: ${insights.moodByDayOfWeek.easiest ?? "—"}`}
              />
              <StatCard
                icon="fa-heart-pulse"
                label="Sessions that helped"
                value={
                  efficacy?.measuredSessions
                    ? `${Math.round(efficacy.improvementRate * 100)}%`
                    : "—"
                }
                hint={
                  efficacy?.measuredSessions
                    ? `${efficacy.improvedSessions} of ${efficacy.measuredSessions} measured`
                    : "Rate a session to start measuring"
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-3 text-lg font-semibold">By time of day</h2>
                <dl className="space-y-2">
                  {Object.entries(insights.moodByTimeOfDay).map(([slot, mood]) => (
                    <div key={slot} className="flex justify-between text-sm">
                      <dt className="capitalize text-gray-400">{slot}</dt>
                      <dd className="font-medium capitalize text-white">{mood}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h2 className="mb-3 text-lg font-semibold">What you gravitate to</h2>
                {insights.topGenres.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {insights.topGenres.map((genre) => (
                      <li
                        key={genre}
                        className="rounded-full bg-indigo-500/20 px-3 py-1 text-sm text-indigo-200"
                      >
                        {genre}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400">
                    Rate a few songs and your taste will show up here.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default Insights;
