import mongoose from "mongoose";

/**
 * How someone is actually behaving inside a plan, as one document.
 *
 * Not a new source of truth — every field is derived from data already
 * collected. It exists so the adaptation engine reads one document rather than
 * running five aggregations per user per night, and so a rule change can be
 * replayed over history by rebuilding this and re-running the rules.
 */
const planBehaviourSchema = new mongoose.Schema({
  planId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ListeningPlan",
    required: true,
    unique: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  /** Did they do the thing. Distinct from whether it worked. */
  adherence: {
    due: { type: Number, default: 0 },
    done: { type: Number, default: 0 },
    missed: { type: Number, default: 0 },
    rate: { type: Number, default: null },
  },

  /** When the plan asked versus when they actually turned up. */
  timing: {
    scheduledHourMean: { type: Number, default: null },
    actualHourMean: { type: Number, default: null },
    driftHours: { type: Number, default: null },
    samples: { type: Number, default: 0 },
  },

  engagement: {
    abandoned: { type: Number, default: 0 },
    ratingsGiven: { type: Number, default: 0 },
  },

  /** Whether it worked, measured against the counterfactual baseline. */
  effect: {
    meanLift: { type: Number, default: null },
    meanArousalShift: { type: Number, default: null },
    samples: { type: Number, default: 0 },
  },

  /** Movement relative to where they started. */
  trend: {
    direction: {
      type: String,
      enum: ["up", "flat", "down", "unknown"],
      default: "unknown",
    },
    recentMean: { type: Number, default: null },
    change: { type: Number, default: null },
    samples: { type: Number, default: 0 },
  },

  computedAt: { type: Date, default: Date.now },
});

planBehaviourSchema.index({ userId: 1 });

export default mongoose.model("PlanBehaviour", planBehaviourSchema);
