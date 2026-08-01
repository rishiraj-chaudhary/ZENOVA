import Impression from "../models/Impression.js";
import config from "../config/environment.js";
import logger from "../utils/logger.js";
import { contextOf } from "./baselineService.js";

/**
 * Which policy produced a recommendation, and how it was served.
 *
 * Sits alongside recommendationService rather than replacing it: the existing
 * path keeps working and this decides the arm and records what was served, so
 * nothing validated has to be rewritten to make the data causally usable.
 */

/** Bump when ranking changes in a way that makes old impressions incomparable. */
export const POLICY_VERSION = "shrinkage-v1";

/**
 * Share of sessions served a diverse random pick instead of the ranked one.
 *
 * This is the price of a valid number. Without an arm where the recommendation
 * carries no song signal, there is nothing to compare a measured delta against,
 * and the ledger's estimates stay confounded no matter how much data arrives.
 * Kept at 5% and configurable, so it can be turned off entirely if a demo needs
 * every session optimised.
 */
export const CONTROL_ARM_RATE = Number.parseFloat(
  process.env.CONTROL_ARM_RATE ?? "0.05"
);

/**
 * Assigns an arm. Randomized per session, not per user — a user permanently in
 * the control arm would get a permanently worse product, and the comparison
 * would be between people rather than between recommendations.
 */
export const assignArm = () =>
  Math.random() < CONTROL_ARM_RATE ? "control" : "policy";

/**
 * Records what was served and with what probability.
 *
 * Fire-and-forget: a failure to log an impression must never cost the user
 * their recommendation. The cost of the loss is a gap in evaluation data, not a
 * broken response.
 */
export const recordImpressions = async ({
  userId,
  sessionId,
  recommendations,
  arm,
  startingMood,
  detectedMood,
  timeZone,
}) => {
  if (!sessionId || recommendations.length === 0) return;

  const { hourOfDay, dayOfWeek } = contextOf(new Date(), timeZone);

  // The ranker is deterministic today, so every served candidate had the same
  // probability of appearing. Logged anyway — the estimators are written
  // against a field that has always existed, and nothing needs backfilling when
  // sampling arrives.
  const propensity = 1 / recommendations.length;

  try {
    await Impression.insertMany(
      recommendations.map((song, position) => ({
        userId,
        musicId: song.musicId,
        sessionId,
        position,
        propensity,
        policyVersion: arm === "control" ? "control-random-v1" : POLICY_VERSION,
        arm,
        context: { startingMood, detectedMood, hourOfDay, dayOfWeek },
      })),
      { ordered: false }
    );
  } catch (error) {
    // Duplicate key means the same session was recorded twice, which is a
    // no-op rather than a problem.
    if (error.code !== 11000) {
      logger.warn("could not record impressions", { detail: error.message });
    }
  }
};

export default { assignArm, recordImpressions, POLICY_VERSION, CONTROL_ARM_RATE };
