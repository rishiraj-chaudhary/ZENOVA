import AgentRun from "../models/AgentRun.js";
import BaselineCell from "../models/BaselineCell.js";
import Impression from "../models/Impression.js";
import SessionOutcome from "../models/SessionOutcome.js";
import { getLedgerCoverage } from "../services/songEffectService.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getLlmMetrics } from "../utils/llmMetrics.js";

/**
 * What the system is actually doing, in one response.
 *
 * There was no view of any of this: spend, which model answered, how much
 * measured evidence exists, whether the control arm is filling, how often the
 * verifier can support what the assistant said. Once an agent spends money per
 * turn, that stops being optional.
 *
 * Scoped to the caller's own activity plus population aggregates that name
 * nobody, so it needs no admin role to be safe to expose.
 */
export const getOperationalSnapshot = asyncHandler(async (req, res) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    coverage,
    impressions,
    controlImpressions,
    measuredSessions,
    baselineCells,
    runs,
    verification,
  ] = await Promise.all([
    getLedgerCoverage(),
    Impression.countDocuments({ servedAt: { $gte: since } }),
    Impression.countDocuments({ servedAt: { $gte: since }, arm: "control" }),
    SessionOutcome.countDocuments({ moodAfter: { $ne: null } }),
    BaselineCell.countDocuments({}),
    AgentRun.aggregate([
      { $match: { startedAt: { $gte: since } } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          cost: { $sum: "$estimatedCostUsd" },
        },
      },
    ]),
    AgentRun.aggregate([
      { $match: { startedAt: { $gte: since }, verificationRate: { $ne: null } } },
      { $group: { _id: null, mean: { $avg: "$verificationRate" }, runs: { $sum: 1 } } },
    ]),
  ]);

  const llm = getLlmMetrics();

  res.json({
    windowDays: 7,

    // The question the failover chain made unanswerable: which model is really
    // serving traffic, and how often is it not the one that was configured?
    llm: {
      totals: llm.totals,
      servedBy: Object.fromEntries(
        Object.entries(llm.operations).map(([operation, stats]) => [
          operation,
          { servedBy: stats.servedBy, fallbackRate: stats.fallbackRate },
        ])
      ),
    },

    measurement: {
      ...coverage,
      measuredSessions,
      baselineCells,
      // The control arm's whole purpose is to fill; if this stays at zero the
      // lift numbers are still confounded.
      controlShare: impressions > 0 ? controlImpressions / impressions : null,
      impressionsThisWeek: impressions,
    },

    agent: {
      runsByStatus: Object.fromEntries(runs.map((row) => [row._id, row.count])),
      costUsdThisWeek: Number(
        runs.reduce((sum, row) => sum + (row.cost ?? 0), 0).toFixed(4)
      ),
      // How often the assistant's factual claims could be re-derived from the
      // tool output it cited. A first-class metric, not a debugging aid.
      verificationRate: verification[0]?.mean ?? null,
      verifiedRuns: verification[0]?.runs ?? 0,
    },
  });
});
