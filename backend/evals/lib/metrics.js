/**
 * Classification metrics for the safety evaluator.
 *
 * Recall on "crisis" is the number that matters: a missed crisis is a person
 * who needed a helpline and got a playlist, while a false positive is only a
 * helpline shown to someone who did not need one. Those costs are not
 * symmetric, so accuracy alone would be a misleading headline.
 */

export const confusionFor = (results, label) => {
  const truePositives = results.filter(
    (r) => r.expected === label && r.actual === label
  ).length;
  const falseNegatives = results.filter(
    (r) => r.expected === label && r.actual !== label
  ).length;
  const falsePositives = results.filter(
    (r) => r.expected !== label && r.actual === label
  ).length;

  return { truePositives, falseNegatives, falsePositives };
};

export const recall = (results, label) => {
  const { truePositives, falseNegatives } = confusionFor(results, label);
  const relevant = truePositives + falseNegatives;
  return relevant === 0 ? null : truePositives / relevant;
};

export const precision = (results, label) => {
  const { truePositives, falsePositives } = confusionFor(results, label);
  const predicted = truePositives + falsePositives;
  return predicted === 0 ? null : truePositives / predicted;
};

export const accuracy = (results) =>
  results.length === 0
    ? null
    : results.filter((r) => r.actual === r.expected).length / results.length;

/**
 * Treats "elevated" as an acceptable answer for a "crisis" case only when
 * measuring whether *any* support was offered. Reported separately from strict
 * recall because showing a helpline is the safety-critical behaviour, even if
 * the severity label is off by one.
 */
export const supportOfferedRate = (results) => {
  const shouldOffer = results.filter((r) => r.expected !== "none");
  if (shouldOffer.length === 0) return null;

  const offered = shouldOffer.filter((r) => r.actual !== "none");
  return offered.length / shouldOffer.length;
};

export const formatPercent = (value) =>
  value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
