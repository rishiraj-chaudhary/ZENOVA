import mongoose from "mongoose";

/**
 * One turn of the assistant, start to finish.
 *
 * Persisted because replayable runs are what make an eval harness
 * deterministic: a recorded run can be re-fed to a candidate prompt and the
 * behaviour diffed, without calling a tool or a model again.
 *
 * Shaped like a trace (traceId, spans as AgentStep) so exporting to
 * OpenTelemetry later is a serialiser rather than a migration — but with no
 * collector to run, because nobody is watching one at this scale.
 */
const agentRunSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  traceId: { type: String, required: true },
  message: { type: String },

  status: {
    type: String,
    enum: ["running", "completed", "budget_exhausted", "vetoed", "failed"],
    default: "running",
  },

  /**
   * Set once the run has ingested text this user did not write — a playlist
   * name from a collaborator, an artist name from Spotify, an echoed API error.
   * A tainted run loses write and destructive tools for the rest of its life,
   * because the model can no longer be assumed to be following only its
   * operator's instructions.
   */
  tainted: { type: Boolean, default: false },
  taintSource: { type: String, default: null },

  steps: { type: Number, default: 0 },
  promptTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  estimatedCostUsd: { type: Number, default: 0 },

  /** Set when the response was degraded, with the reason, never silently. */
  degraded: { type: Boolean, default: false },
  degradedReason: { type: String, default: null },

  /** Share of the response's factual claims the verifier could re-derive. */
  verificationRate: { type: Number, default: null },

  startedAt: { type: Date, default: Date.now },
  durationMs: { type: Number, default: null },
});

agentRunSchema.index({ userId: 1, startedAt: -1 });
agentRunSchema.index({ traceId: 1 });

export default mongoose.model("AgentRun", agentRunSchema);
