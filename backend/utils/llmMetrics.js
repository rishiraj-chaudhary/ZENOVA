import logger from "./logger.js";

/**
 * In-process counters for Gemini usage.
 *
 * Deliberately not a full tracing vendor: the questions that were previously
 * unanswerable — what does a recommendation cost, what is p95 latency, how
 * often does generation fail — need aggregation, not per-span detail. Exposed
 * at /api/health/llm so a dashboard or alert can scrape it.
 *
 * Resets on restart. Wire to Langfuse or OpenTelemetry when durability matters.
 */

// Gemini 2.0 Flash list price, USD per million tokens. Update when it changes.
const PRICE_PER_MILLION = { input: 0.1, output: 0.4 };
const LATENCY_SAMPLE_SIZE = 500;

const createBucket = () => ({
  calls: 0,
  success: 0,
  errors: 0,
  parseErrors: 0,
  promptTokens: 0,
  outputTokens: 0,
  latencies: [],

  /**
   * Which model actually answered, counted per name.
   *
   * A failover chain can mask a dead or quota-exhausted primary indefinitely:
   * every request 429s at the head, falls through, and succeeds on a model
   * nobody chose — while the success rate stays at 100% and the configured
   * model name says something untrue. Without this, "which model served this?"
   * is unanswerable from the outside, and any eval result describes a model you
   * may not be running.
   */
  servedBy: {},

  /** Requests that did not get the configured primary model. */
  fellBack: 0,
});

const buckets = new Map();

const bucketFor = (operation) => {
  if (!buckets.has(operation)) buckets.set(operation, createBucket());
  return buckets.get(operation);
};

export const recordLlmCall = ({
  operation,
  durationMs,
  outcome,
  promptTokens = 0,
  outputTokens = 0,
  model,
  wasFallback = false,
}) => {
  const bucket = bucketFor(operation);

  bucket.calls += 1;
  bucket.promptTokens += promptTokens;
  bucket.outputTokens += outputTokens;

  if (outcome === "success" && model) {
    bucket.servedBy[model] = (bucket.servedBy[model] ?? 0) + 1;
    if (wasFallback) bucket.fellBack += 1;
  }

  if (outcome === "success") bucket.success += 1;
  else if (outcome === "parse_error") bucket.parseErrors += 1;
  else bucket.errors += 1;

  if (durationMs > 0) {
    // Bounded ring so a long-running process cannot grow this without limit.
    bucket.latencies.push(durationMs);
    if (bucket.latencies.length > LATENCY_SAMPLE_SIZE) bucket.latencies.shift();
  }
};

const percentile = (sorted, p) =>
  sorted.length === 0 ? 0 : sorted[Math.min(Math.floor(sorted.length * p), sorted.length - 1)];

const costOf = ({ promptTokens, outputTokens }) =>
  (promptTokens / 1e6) * PRICE_PER_MILLION.input +
  (outputTokens / 1e6) * PRICE_PER_MILLION.output;

const summariseBucket = (bucket) => {
  const sorted = [...bucket.latencies].sort((a, b) => a - b);

  return {
    calls: bucket.calls,
    successRate: bucket.calls ? bucket.success / bucket.calls : null,
    errors: bucket.errors,
    parseErrors: bucket.parseErrors,
    promptTokens: bucket.promptTokens,
    outputTokens: bucket.outputTokens,
    estimatedCostUsd: Number(costOf(bucket).toFixed(4)),

    // The answer to "which model is actually serving this?" — see createBucket.
    servedBy: bucket.servedBy,
    fallbackRate: bucket.success ? bucket.fellBack / bucket.success : null,

    latencyMs: {
      p50: Math.round(percentile(sorted, 0.5)),
      p95: Math.round(percentile(sorted, 0.95)),
      p99: Math.round(percentile(sorted, 0.99)),
    },
  };
};

export const getLlmMetrics = () => {
  const operations = Object.fromEntries(
    [...buckets.entries()].map(([operation, bucket]) => [
      operation,
      summariseBucket(bucket),
    ])
  );

  const totals = [...buckets.values()].reduce(
    (sum, bucket) => ({
      calls: sum.calls + bucket.calls,
      promptTokens: sum.promptTokens + bucket.promptTokens,
      outputTokens: sum.outputTokens + bucket.outputTokens,
      estimatedCostUsd: sum.estimatedCostUsd + costOf(bucket),
    }),
    { calls: 0, promptTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
  );

  return {
    totals: { ...totals, estimatedCostUsd: Number(totals.estimatedCostUsd.toFixed(4)) },
    operations,
  };
};

export const resetLlmMetrics = () => buckets.clear();

/** Periodic snapshot, so cost trends land in the log aggregator too. */
export const startMetricsReporter = (intervalMs = 15 * 60 * 1000) => {
  const timer = setInterval(() => {
    const metrics = getLlmMetrics();
    if (metrics.totals.calls > 0) logger.info("llm metrics", metrics.totals);
  }, intervalMs);

  timer.unref();
  return timer;
};
