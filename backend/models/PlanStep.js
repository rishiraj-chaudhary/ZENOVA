import mongoose from "mongoose";

/**
 * One day of a plan.
 *
 * A separate collection rather than an array on the plan: the scheduler queries
 * steps by due date across every user, and an embedded array would mean
 * scanning every plan document to find today's work.
 */
const planStepSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ListeningPlan",
    required: true,
    index: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  dayIndex: { type: Number, required: true, min: 0 },

  /** In the user's own timezone, because a step due at their 3am is a step missed. */
  dueAt: { type: Date, required: true },

  /**
   * A rest day is a real step, not an absence.
   *
   * Plans that ask for something every single day get abandoned, and a rest day
   * the plan chose reads very differently from a day the user skipped.
   */
  kind: {
    type: String,
    enum: ["session", "check_in", "rest"],
    default: "session",
  },

  prescription: {
    therapeuticFunction: { type: String, default: "support" },
    targetArousalShift: { type: Number, default: 0 },
  },

  status: {
    type: String,
    enum: ["pending", "done", "missed", "rescheduled", "skipped"],
    default: "pending",
  },

  /** The recommendation this step became, and the measurement it produced. */
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Recommendation", default: null },
  outcomeId: { type: mongoose.Schema.Types.ObjectId, ref: "SessionOutcome", default: null },

  completedAt: { type: Date, default: null },
});

planStepSchema.index({ planId: 1, dayIndex: 1 }, { unique: true });
planStepSchema.index({ userId: 1, dueAt: 1, status: 1 });

export default mongoose.model("PlanStep", planStepSchema);
