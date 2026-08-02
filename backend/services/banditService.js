import SongEffect from "../models/SongEffect.js";
import { MIN_OBSERVATIONS, PROVISIONAL_OBSERVATIONS } from "./songEffectService.js";

/**
 * Thompson sampling over the measured-effect posterior.
 *
 * Ranking by the shrunk mean is pure exploitation: a song that has never been
 * tried can never rise, so the ledger only ever learns about songs it already
 * likes. Sampling from each song's posterior instead means uncertainty itself
 * earns a turn — a song with two observations has a wide posterior and will
 * sometimes be drawn ahead of a well-established one, which is exactly the
 * exploration the ledger needs to stop being self-confirming.
 *
 * The temperature comes from the user's listening entropy (personaService), so
 * a person with narrow taste is not pushed around while a person who listens to
 * everything gets real variety.
 */

/** Shrinks toward no effect, matching how the ledger already ranks. */
const PRIOR_STRENGTH = MIN_OBSERVATIONS;
const PRIOR_VARIANCE = 1.0;

/** Box-Muller. Deterministic given the random source, which the tests replace. */
export const sampleNormal = (mean, standardDeviation, random = Math.random) => {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + standardDeviation * z;
};

/**
 * The posterior for one cell: a shrunk mean, and a spread that narrows as
 * observations accumulate.
 */
export const posteriorOf = (cell) => {
  const observations = cell.observations ?? 0;
  const mean = cell.sumDelta / (observations + PRIOR_STRENGTH);

  const empiricalVariance =
    observations > 1
      ? Math.max(cell.sumSquaredDelta / observations - (cell.sumDelta / observations) ** 2, 0)
      : PRIOR_VARIANCE;

  // Standard error of the posterior mean, floored so a zero-variance cell — five
  // identical ratings — does not claim certainty it has not earned.
  const standardDeviation = Math.sqrt(
    (empiricalVariance + PRIOR_VARIANCE) / (observations + PRIOR_STRENGTH)
  );

  return { mean, standardDeviation, observations };
};

/**
 * Draws a ranking, and reports the probability each candidate was chosen with.
 *
 * The propensity is what makes the choice evaluable later. It is estimated by
 * simulation rather than derived in closed form — a normal-max probability has
 * no clean analytic solution — which is slower but honest, and the counts are
 * small.
 */
const PROPENSITY_SAMPLES = 200;

export const sampleRanking = (cells, { temperature = 0.4, limit = 5, random = Math.random } = {}) => {
  if (cells.length === 0) return [];

  const posteriors = cells.map((cell) => ({ cell, ...posteriorOf(cell) }));

  const draw = () =>
    posteriors
      .map((entry) => ({
        entry,
        score: sampleNormal(entry.mean, entry.standardDeviation * temperature, random),
      }))
      .sort((a, b) => b.score - a.score);

  const chosen = draw().slice(0, limit);

  // How often each chosen candidate lands in the top `limit` across repeated
  // draws — the probability this policy would have served it.
  const wins = new Map();
  for (let i = 0; i < PROPENSITY_SAMPLES; i += 1) {
    for (const { entry } of draw().slice(0, limit)) {
      const key = entry.cell.musicId.toString();
      wins.set(key, (wins.get(key) ?? 0) + 1);
    }
  }

  return chosen.map(({ entry }, position) => ({
    musicId: entry.cell.musicId,
    position,
    posteriorMean: Number(entry.mean.toFixed(4)),
    // The observed average, kept under the name the prompt already reads. The
    // posterior mean is the ranking quantity; the raw mean is what a human — or
    // a model — should be told, because it is the thing that was measured.
    meanDelta:
      entry.observations > 0 ? entry.cell.sumDelta / entry.observations : 0,
    observations: entry.observations,
    propensity: Math.min(
      Math.max((wins.get(entry.cell.musicId.toString()) ?? 1) / PROPENSITY_SAMPLES, 0.001),
      1
    ),
    evidence:
      entry.observations >= MIN_OBSERVATIONS
        ? "established"
        : entry.observations >= PROVISIONAL_OBSERVATIONS
          ? "provisional"
          : "exploring",
  }));
};

/**
 * Songs that reliably make things worse for people who start low.
 *
 * The rumination trap: music that matches a low mood and keeps someone there.
 * A recommender optimising for engagement would surface exactly these, because
 * people do listen to them. This is a safety feature that falls out of having
 * outcome data, and no mainstream recommender has it.
 */
export const NEGATIVE_EFFECT_THRESHOLD = -0.4;

export const findHarmfulSongs = async (startingMood, { minObservations = PROVISIONAL_OBSERVATIONS } = {}) => {
  const cells = await SongEffect.find({
    startingMood,
    observations: { $gte: minObservations },
  }).lean();

  return cells
    .map((cell) => ({ cell, ...posteriorOf(cell) }))
    .filter((entry) => {
      // Both the shrunk mean and the upper end of the interval have to be
      // negative. One bad run is not evidence of harm.
      const upper = entry.mean + 1.96 * entry.standardDeviation;
      return entry.mean <= NEGATIVE_EFFECT_THRESHOLD && upper < 0;
    })
    .map((entry) => ({
      musicId: entry.cell.musicId,
      meanEffect: Number(entry.mean.toFixed(3)),
      observations: entry.observations,
    }));
};

/** Ranks with sampling, then removes anything measured to do harm. */
export const rankWithExploration = async (
  startingMood,
  { temperature, limit = 5, random } = {}
) => {
  const [cells, harmful] = await Promise.all([
    SongEffect.find({ startingMood, observations: { $gte: 1 } })
      .sort({ observations: -1 })
      .limit(200)
      .lean(),
    findHarmfulSongs(startingMood),
  ]);

  const banned = new Set(harmful.map((entry) => entry.musicId.toString()));
  const eligible = cells.filter((cell) => !banned.has(cell.musicId.toString()));

  return {
    ranked: sampleRanking(eligible, { temperature, limit, random }),
    suppressed: harmful,
  };
};
