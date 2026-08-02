import mongoose from "mongoose";

/**
 * A structure for using the app over a few weeks, with measurement attached.
 *
 * Deliberately called a plan and never a programme, protocol or course of
 * treatment. "Follow this to fix your anxiety" is a clinical claim this product
 * cannot make, and the naming is the first line of that defence — it has to
 * hold in copy, notifications and model names alike.
 */
export const DIRECTIONS = {
  wind_down: {
    label: "Wind down at night",
    // What "better" means on each axis. Null means the axis is not the point.
    valenceShift: null,
    arousalShift: -1,
    therapeuticFunction: "calm",
  },
  get_going: {
    label: "Get going in the morning",
    valenceShift: null,
    arousalShift: 1,
    therapeuticFunction: "energize",
  },
  steadier: {
    label: "A steadier week",
    valenceShift: 0,
    arousalShift: 0,
    therapeuticFunction: "support",
  },
  lift: {
    label: "Lift a low stretch",
    valenceShift: 1,
    arousalShift: null,
    therapeuticFunction: "motivate",
  },
};

export const DURATIONS = [7, 14, 28];

const evidenceSchema = new mongoose.Schema({}, { strict: false, _id: false });

const adaptationSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },

    trigger: {
      type: String,
      enum: [
        "low_adherence",
        "time_drift",
        "no_measured_effect",
        "deterioration",
        "rapid_improvement",
      ],
      required: true,
    },

    /** The numbers that fired the rule, so the decision is inspectable. */
    evidence: evidenceSchema,

    /** Shown to the user verbatim. A plan that rearranges itself silently is
     *  one nobody can trust. */
    change: { type: String, required: true },
  },
  { _id: true }
);

const listeningPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  direction: { type: String, enum: Object.keys(DIRECTIONS), required: true },
  durationDays: { type: Number, enum: DURATIONS, required: true },

  status: {
    type: String,
    enum: ["draft", "active", "paused", "completed", "stopped"],
    default: "draft",
  },

  /** Where they were when they started, from their own history. */
  baseline: {
    valence: { type: Number, default: null },
    arousal: { type: Number, default: null },
    samples: { type: Number, default: 0 },
  },

  /**
   * Where the plan aims.
   *
   * Derived from a level this person has actually reached rather than a generic
   * ideal — a target someone has hit before is achievable and honest, and "be
   * happy" is neither. `basis` is stored so the UI can explain where the number
   * came from instead of asserting it.
   */
  target: {
    valence: { type: Number, default: null },
    arousal: { type: Number, default: null },
    basis: {
      type: String,
      enum: ["personal_best_week", "modest_default"],
      default: "modest_default",
    },
    evidence: evidenceSchema,
  },

  /** How many steps a week, which adaptation may lower but never raise. */
  stepsPerWeek: { type: Number, default: 4 },

  /** One notification a day at most, and it can be off without stopping the plan. */
  remindersEnabled: { type: Boolean, default: true },
  reminderHour: { type: Number, min: 0, max: 23, default: null },

  adaptations: { type: [adaptationSchema], default: [] },

  startedAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
});

// One plan at a time. Running two would make every measurement ambiguous about
// which plan caused it.
listeningPlanSchema.index(
  { userId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["draft", "active", "paused"] } } }
);

export default mongoose.model("ListeningPlan", listeningPlanSchema);
