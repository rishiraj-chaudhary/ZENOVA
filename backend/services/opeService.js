import Impression from "../models/Impression.js";
import SessionOutcome from "../models/SessionOutcome.js";

/**
 * Off-policy evaluation: would a different policy have done better?
 *
 * The point of logging propensities. Each past impression carries the
 * probability the policy that ran would have served it, so a candidate policy
 * can be scored against history without anyone having to experience it. Every
 * session ever served becomes evaluation data, permanently.
 *
 * Built now and gated later, deliberately. The estimators need volume for their
 * *estimates* to be tight, not for the estimators to exist and be correct —
 * those are separate decisions, and letting the second delay the first is how a
 * project ends up with a year of unevaluable history.
 */

/** Ratios above this dominate the estimate and are clipped. */
const MAX_WEIGHT = 20;

const clip = (weight) => Math.min(weight, MAX_WEIGHT);

/**
 * Inverse propensity scoring.
 *
 * Unbiased, and famously high-variance: one impression served with probability
 * 0.01 carries a hundred times the weight of a certainty, so a single lucky
 * outcome can swing the whole number. Reported alongside SNIPS rather than
 * alone for exactly that reason.
 */
export const inversePropensityScore = (samples) => {
  if (samples.length === 0) return null;

  const total = samples.reduce(
    (sum, { reward, propensity, targetProbability }) =>
      sum + reward * clip(targetProbability / propensity),
    0
  );

  return total / samples.length;
};

/** Self-normalised IPS: biased, far lower variance, better behaved on small samples. */
export const selfNormalisedScore = (samples) => {
  if (samples.length === 0) return null;

  let weighted = 0;
  let weights = 0;

  for (const { reward, propensity, targetProbability } of samples) {
    const weight = clip(targetProbability / propensity);
    weighted += reward * weight;
    weights += weight;
  }

  return weights > 0 ? weighted / weights : null;
};

/**
 * Doubly robust: consistent if *either* the propensities or the reward model
 * are right, which is why it is the one to gate on.
 */
export const doublyRobustScore = (samples, rewardModel) => {
  if (samples.length === 0) return null;

  const total = samples.reduce((sum, sample) => {
    const predicted = rewardModel(sample);
    const weight = clip(sample.targetProbability / sample.propensity);
    return sum + predicted + weight * (sample.reward - predicted);
  }, 0);

  return total / samples.length;
};

/**
 * Pairs impressions with what actually happened.
 *
 * The reward is the session's lift where one exists — the causal quantity — and
 * the raw delta otherwise, so evaluation degrades to the honest fallback rather
 * than to nothing.
 */
export const buildSamples = async ({ since, policyVersion } = {}) => {
  const filter = {};
  if (since) filter.servedAt = { $gte: since };
  if (policyVersion) filter.policyVersion = policyVersion;

  const impressions = await Impression.find(filter).lean();
  if (impressions.length === 0) return [];

  const outcomes = await SessionOutcome.find({
    sessionId: { $in: [...new Set(impressions.map((i) => i.sessionId))] },
    moodAfter: { $ne: null },
  }).lean();

  const bySession = new Map(outcomes.map((outcome) => [outcome.sessionId.toString(), outcome]));

  return impressions
    .map((impression) => {
      const outcome = bySession.get(impression.sessionId.toString());
      if (!outcome) return null;

      return {
        musicId: impression.musicId,
        propensity: impression.propensity,
        position: impression.position,
        context: impression.context,
        reward: outcome.lift ?? outcome.moodAfter - outcome.moodBefore,
      };
    })
    .filter(Boolean);
};

/**
 * Scores a candidate policy against logged history.
 *
 * `targetPolicy` returns the probability it would have served a given
 * impression. The incumbent's own score is computed the same way, so the
 * comparison is like for like.
 */
export const evaluatePolicy = async ({ samples, targetPolicy, rewardModel }) => {
  const scored = samples.map((sample) => ({
    ...sample,
    targetProbability: targetPolicy(sample),
  }));

  const supported = scored.filter((sample) => sample.propensity > 0);

  const meanReward =
    supported.reduce((sum, sample) => sum + sample.reward, 0) / (supported.length || 1);
  const fallbackModel = rewardModel ?? (() => meanReward);

  return {
    samples: supported.length,
    // The logged policy's own average, for comparison.
    loggedValue: supported.length ? meanReward : null,
    ips: inversePropensityScore(supported),
    snips: selfNormalisedScore(supported),
    doublyRobust: doublyRobustScore(supported, fallbackModel),
    /**
     * Effective sample size. When the target policy disagrees sharply with the
     * logged one, a handful of impressions carry all the weight and the estimate
     * is worth much less than the raw count suggests.
     */
    effectiveSampleSize: (() => {
      const weights = supported.map((s) => clip(s.targetProbability / s.propensity));
      const sum = weights.reduce((a, b) => a + b, 0);
      const sumSquares = weights.reduce((a, b) => a + b * b, 0);
      return sumSquares > 0 ? Number((sum * sum / sumSquares).toFixed(1)) : 0;
    })(),
  };
};

/** Enough weight behind the estimate to be worth acting on. */
export const MIN_EFFECTIVE_SAMPLES = 100;

export const canDecide = (evaluation) =>
  evaluation.effectiveSampleSize >= MIN_EFFECTIVE_SAMPLES;
