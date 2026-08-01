import { useEffect, useState } from "react";
import * as wellbeingAPI from "../api/wellbeingAPI.js";

/**
 * What the measurement actually found.
 *
 * The effect ledger has always existed and was read in exactly one place — the
 * ranker — so the product measured which songs helped and then never told
 * anyone. This is that data, shown with the honesty the estimator already
 * applies internally: every row carries how many sessions it rests on, and a
 * thin one says so instead of reading as a finding.
 */
const EVIDENCE_LABEL = {
  established: { text: "Measured", tone: "text-emerald-300 border-emerald-500/40" },
  provisional: { text: "Early signal", tone: "text-amber-300 border-amber-500/40" },
  insufficient: { text: "Too early to say", tone: "text-gray-400 border-white/20" },
};

const EffectRow = ({ entry }) => {
  const evidence = EVIDENCE_LABEL[entry.evidence] ?? EVIDENCE_LABEL.insufficient;
  const value = entry.meanLift ?? entry.shrunkDelta ?? 0;

  // The scale is a 1-5 mood rating, so a full point is a large move.
  const width = Math.min(Math.abs(value) / 2, 1) * 100;

  return (
    <li className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3">
      {entry.song.albumArt ? (
        <img src={entry.song.albumArt} alt="" className="h-10 w-10 rounded object-cover" loading="lazy" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
          <i className="fa-solid fa-music text-gray-400" aria-hidden="true" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{entry.song.title}</p>
        <p className="truncate text-xs text-gray-400">{entry.song.artist}</p>

        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-emerald-400/80"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-emerald-300">
          {value > 0 ? "+" : ""}
          {value.toFixed(2)}
        </p>
        <p className={`mt-0.5 rounded border px-1.5 py-0.5 text-[0.6rem] ${evidence.tone}`}>
          {evidence.text}
        </p>
        <p className="mt-0.5 text-[0.6rem] text-gray-500 tabular-nums">
          {entry.observations} {entry.observations === 1 ? "session" : "sessions"}
        </p>
      </div>
    </li>
  );
};

const ProvenSongs = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    wellbeingAPI.fetchProvenSongs().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-red-300">Couldn&apos;t load your measurements: {error}</p>
      </section>
    );
  }

  if (!data) return null;

  const hasPersonal = data.personal.length > 0;
  const hasPopulation = data.population.length > 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-semibold text-white">What has worked</h2>
      <p className="mt-1 text-sm text-gray-400">
        Measured from your before-and-after ratings — not from what&apos;s popular.
      </p>

      {!hasPersonal && !hasPopulation && (
        <p className="mt-5 text-sm text-gray-400">
          Nothing measured yet. Rate your mood before and after a listening session and
          this fills in — one session is a data point, not an answer, so it takes a few.
        </p>
      )}

      {hasPersonal && (
        <>
          <h3 className="mt-6 text-xs uppercase tracking-wider text-gray-500">For you</h3>
          <ul className="mt-2 space-y-2">
            {data.personal.map((entry) => (
              <EffectRow key={entry.musicId} entry={entry} />
            ))}
          </ul>
        </>
      )}

      {hasPopulation && (
        <>
          <h3 className="mt-6 text-xs uppercase tracking-wider text-gray-500">
            For people who started where you did
          </h3>
          {/* Kept separate on purpose: "this worked for you" and "this worked for
              people like you" are different claims and must not be merged. */}
          <ul className="mt-2 space-y-2">
            {data.population.map((entry) => (
              <EffectRow key={entry.musicId} entry={entry} />
            ))}
          </ul>
        </>
      )}

      {data.coverage?.observations > 0 && (
        <p className="mt-5 text-xs text-gray-500">
          {data.coverage.observations} measured sessions across{" "}
          {data.coverage.cells} song-and-mood combinations.{" "}
          {data.coverage.establishedCells === 0
            ? "None have enough data to be conclusive yet."
            : `${data.coverage.establishedCells} have enough data to be conclusive.`}
        </p>
      )}
    </section>
  );
};

export default ProvenSongs;
