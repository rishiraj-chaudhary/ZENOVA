import mongoose from "mongoose";

/**
 * An append-only record of every write the assistant made on someone's behalf.
 *
 * Separate from AgentStep, which is diagnostic and may be pruned. This is the
 * answer to "the assistant changed something — who authorised that, and when?",
 * and it has to outlive the trace it came from.
 */
const toolAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: "AgentRun" },

  tool: { type: String, required: true },
  sideEffect: { type: String, enum: ["write", "destructive", "external"], required: true },
  input: { type: mongoose.Schema.Types.Mixed },

  /** How the user agreed: which confirmation, and when they gave it. */
  confirmedAt: { type: Date, default: null },
  confirmationToken: { type: String, default: null },

  succeeded: { type: Boolean, default: true },
  performedAt: { type: Date, default: Date.now },
});

toolAuditSchema.index({ userId: 1, performedAt: -1 });

export default mongoose.model("ToolAudit", toolAuditSchema);
