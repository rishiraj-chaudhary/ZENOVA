import AgentRun from "../../models/AgentRun.js";
import { toObjectId } from "../../utils/toObjectId.js";

/**
 * Hard ceilings on a run, and on a person's day.
 *
 * A single-call-per-turn chat has a naturally bounded cost. A tool loop does
 * not: a model that keeps calling tools keeps spending, and the failure mode is
 * a bill rather than an error. The per-run caps stop a runaway turn; the daily
 * cap is the one that protects the account.
 */
export const MAX_STEPS = 8;
export const MAX_WALL_CLOCK_MS = 20_000;
export const MAX_RUN_COST_USD = 0.05;

export const DAILY_COST_CAP_USD = Number.parseFloat(
  process.env.AGENT_DAILY_COST_CAP_USD ?? "0.50"
);

export const createBudget = ({ maxSteps = MAX_STEPS } = {}) => {
  const startedAt = Date.now();

  return {
    steps: 0,
    costUsd: 0,
    promptTokens: 0,
    outputTokens: 0,

    spend({ promptTokens = 0, outputTokens = 0, costUsd = 0 }) {
      this.promptTokens += promptTokens;
      this.outputTokens += outputTokens;
      this.costUsd += costUsd;
    },

    /** Why the run must stop, or null to continue. Never an implicit stop. */
    breach() {
      if (this.steps >= maxSteps) return "step limit reached";
      if (Date.now() - startedAt > MAX_WALL_CLOCK_MS) return "took too long";
      if (this.costUsd > MAX_RUN_COST_USD) return "cost limit reached";
      return null;
    },

    elapsedMs: () => Date.now() - startedAt,
  };
};

/**
 * What this person has already spent today, from the run ledger.
 *
 * Counted in the user's own day rather than UTC, for the same reason streaks
 * are: a cap that resets at 05:30 local is a cap nobody can reason about.
 */
export const spentTodayUsd = async (userId, timeZone = "UTC") => {
  const startOfDay = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date()) + "T00:00:00.000Z"
  );

  const [totals] = await AgentRun.aggregate([
    { $match: { userId: toObjectId(userId), startedAt: { $gte: startOfDay } } },
    { $group: { _id: null, cost: { $sum: "$estimatedCostUsd" } } },
  ]);

  return totals?.cost ?? 0;
};

export const withinDailyCap = async (userId, timeZone) =>
  (await spentTodayUsd(userId, timeZone)) < DAILY_COST_CAP_USD;
