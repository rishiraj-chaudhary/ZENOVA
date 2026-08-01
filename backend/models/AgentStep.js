import mongoose from "mongoose";

/**
 * One span within a run: a model call, a tool call, the supervisor, the
 * verifier.
 *
 * Tool inputs and outputs are recorded verbatim because the verifier re-derives
 * the response's factual claims from exactly these values. Without the recorded
 * output there is nothing to check a claim against, and groundedness would fall
 * back to asking a model whether a model was right.
 */
const agentStepSchema = new mongoose.Schema({
  runId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AgentRun",
    required: true,
    index: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  parentStepId: { type: mongoose.Schema.Types.ObjectId, default: null },
  index: { type: Number, required: true },

  kind: {
    type: String,
    enum: ["model", "tool", "supervisor", "verifier"],
    required: true,
  },

  name: { type: String, required: true },
  input: { type: mongoose.Schema.Types.Mixed },
  output: { type: mongoose.Schema.Types.Mixed },

  /** Why a call was refused, when it was — the audit trail for toolAuth. */
  authorized: { type: Boolean, default: true },
  authorizationError: { type: String, default: null },

  outcome: { type: String, enum: ["ok", "error", "denied"], default: "ok" },
  errorMessage: { type: String, default: null },

  startedAt: { type: Date, default: Date.now },
  durationMs: { type: Number, default: 0 },
  promptTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
});

agentStepSchema.index({ runId: 1, index: 1 });
agentStepSchema.index({ userId: 1, startedAt: -1 });

export default mongoose.model("AgentStep", agentStepSchema);
