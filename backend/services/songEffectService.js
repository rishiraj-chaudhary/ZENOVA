import SongEffect from "../models/SongEffect.js";
import logger from "../utils/logger.js";

/**
 * Below this many observations a cell's mean is noise, not evidence. Surfacing
 * "this song lifts people like you" off three data points would be the same
 * unearned confidence the product's disclaimers exist to avoid.
 */
export const MIN_OBSERVATIONS = 20;

/** Shown while a cell is still accumulating, so thin data reads as thin. */
export const PROVISIONAL_OBSERVATIONS = 5;

/**
 * Records one completed session against every song it contained.
 *
 * Attribution is deliberately coarse: the whole set gets credit for the
 * measured change, because per-track attribution needs listen telemetry the
 * player does not yet report. Coarse and honest beats precise and invented.
 */
export const recordSessionEffect = async ({ songIds, moodBefore, moodAfter }) => {
  if (!songIds?.length || moodBefore == null || moodAfter == null) return 0;

  const delta = moodAfter - moodBefore;
  const now = new Date();

  const operations = songIds.map((musicId) => ({
    updateOne: {
      filter: { musicId, startingMood: moodBefore },
      update: {
        $inc: { observations: 1, sumDelta: delta, sumSquaredDelta: delta * delta },
        $set: { lastObservedAt: now },
      },
      upsert: true,
    },
  }));

  try {
    // Atomic per cell, so concurrent sessions cannot lose each other's counts.
    const result = await SongEffect.bulkWrite(operations, { ordered: false });
    return result.modifiedCount + result.upsertedCount;
  } catch (error) {
    // Effect accounting is analytics; it must never fail the user's session.
    logger.error("failed to record song effect", { detail: error.message });
    return 0;
  }
};

/**
 * Strength of the prior, expressed in pseudo-observations of zero effect.
 *
 * The prior is "this song does nothing", which is the honest default. A cell
 * must accumulate real evidence to move away from it.
 */
const PRIOR_STRENGTH = MIN_OBSERVATIONS;

const summarise = (cell) => {
  const mean = cell.sumDelta / cell.observations;

  // Population variance from the running sums: E[x²] − E[x]².
  const variance = Math.max(
    cell.sumSquaredDelta / cell.observations - mean * mean,
    0
  );
  const standardError = Math.sqrt(variance / cell.observations);

  /**
   * Posterior mean under a zero-effect prior.
   *
   * Ranking on the observed mean, or on a confidence bound derived from
   * observed variance, both fail the same way: five identical +3 ratings have
   * zero measured variance, so the interval collapses and thin evidence
   * outranks strong evidence. Shrinkage encodes sample size directly, so a
   * mean of +3 from five sessions scores below +1 from sixty.
   */
  const shrunkDelta = cell.sumDelta / (cell.observations + PRIOR_STRENGTH);

  return {
    musicId: cell.musicId,
    observations: cell.observations,
    meanDelta: mean,
    shrunkDelta,
    standardError,
    // 95% interval on the raw mean. Reported for display so a claim can be
    // qualified rather than asserted; ranking uses shrunkDelta.
    confidenceLow: mean - 1.96 * standardError,
    confidenceHigh: mean + 1.96 * standardError,
    evidence:
      cell.observations >= MIN_OBSERVATIONS
        ? "established"
        : cell.observations >= PROVISIONAL_OBSERVATIONS
          ? "provisional"
          : "insufficient",
  };
};

/**
 * Songs with the strongest measured lift for people starting in this state.
 *
 * Ranked by the shrunk estimate, not the raw mean. A song averaging +3.0 from
 * five observations should not outrank one averaging +1.0 from sixty, and
 * shrinkage toward a zero-effect prior encodes exactly that.
 */
export const rankByMeasuredEffect = async (startingMood, { limit = 20 } = {}) => {
  const cells = await SongEffect.find({
    startingMood,
    observations: { $gte: PROVISIONAL_OBSERVATIONS },
  })
    .sort({ observations: -1 })
    .limit(200)
    .lean();

  return cells
    .map(summarise)
    .filter((cell) => cell.meanDelta > 0)
    .sort((a, b) => b.shrunkDelta - a.shrunkDelta)
    .slice(0, limit);
};

/** What is known about one song, for the "why this one" explanation. */
export const getEffectForSong = async (musicId, startingMood) => {
  const cell = await SongEffect.findOne({ musicId, startingMood }).lean();
  return cell && cell.observations > 0 ? summarise(cell) : null;
};

/** Coverage stats, so the dashboard can say how much evidence exists at all. */
export const getLedgerCoverage = async () => {
  const [totals] = await SongEffect.aggregate([
    {
      $group: {
        _id: null,
        cells: { $sum: 1 },
        observations: { $sum: "$observations" },
        established: {
          $sum: { $cond: [{ $gte: ["$observations", MIN_OBSERVATIONS] }, 1, 0] },
        },
      },
    },
  ]);

  return totals
    ? {
        cells: totals.cells,
        observations: totals.observations,
        establishedCells: totals.established,
      }
    : { cells: 0, observations: 0, establishedCells: 0 };
};
