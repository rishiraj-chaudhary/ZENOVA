import crypto from "crypto";
import AgentRun from "../../models/AgentRun.js";
import AgentStep from "../../models/AgentStep.js";
import ToolAudit from "../../models/ToolAudit.js";
import logger from "../../utils/logger.js";

/**
 * Run and span persistence.
 *
 * The load-bearing half of observability at this scale: a stored run can be
 * replayed against a candidate prompt with its recorded tool outputs, which is
 * what makes the eval harness deterministic. Span shape is kept
 * OpenTelemetry-compatible so exporting later is a serialiser rather than a
 * migration — but there is no collector, because nobody is watching one.
 */
export const startRun = async ({ userId, message }) => {
  const run = await AgentRun.create({
    userId,
    message,
    traceId: crypto.randomBytes(16).toString("hex"),
  });

  return run;
};

export const recordStep = async ({ runId, userId, index, kind, name, ...rest }) => {
  try {
    return await AgentStep.create({ runId, userId, index, kind, name, ...rest });
  } catch (error) {
    // A trace that fails to write must never fail the turn it is tracing.
    logger.warn("could not record agent step", { detail: error.message });
    return null;
  }
};

export const finishRun = async (run, patch) => {
  try {
    Object.assign(run, patch, { durationMs: Date.now() - run.startedAt.getTime() });
    await run.save();
  } catch (error) {
    logger.warn("could not finalise agent run", { detail: error.message });
  }
  return run;
};

/** The permanent record of a change made on someone's behalf. */
export const recordWrite = async ({ userId, runId, tool, input, confirmationToken, succeeded }) => {
  try {
    await ToolAudit.create({
      userId,
      runId,
      tool: tool.name,
      sideEffect: tool.sideEffect,
      input,
      confirmedAt: confirmationToken ? new Date() : null,
      confirmationToken: confirmationToken ?? null,
      succeeded,
    });
  } catch (error) {
    logger.warn("could not record tool audit", { detail: error.message });
  }
};
