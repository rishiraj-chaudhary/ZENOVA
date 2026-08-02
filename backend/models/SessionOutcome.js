import mongoose from "mongoose";

/**
 * Before/after mood for one listening session — the product's only measure of
 * whether the music actually helped.
 *
 * Everything else in the system records what was *recommended*. This records
 * what *changed*, which is the difference between a suggestion engine and
 * something that can claim an effect.
 */
const MOOD_VALENCE = {
  awful: 1,
  low: 2,
  okay: 3,
  good: 4,
  great: 5,
};

const sessionOutcomeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Recommendation",
      required: true,
    },

    moodBefore: { type: Number, min: 1, max: 5, required: true },
    moodAfter: { type: Number, min: 1, max: 5 },

    /** The 2-D reading, where the user gave one. See MoodEntry.valence. */
    arousalBefore: { type: Number, min: 1, max: 5, default: null },
    arousalAfter: { type: Number, min: 1, max: 5, default: null },

    detectedMood: { type: String },
    songsPlayed: [{ type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" }],

    /**
     * When the user actually played something. A session can be listened to
     * without being rated afterwards, and those two are worth different
     * amounts: listening is real use, measuring is what the ledger needs.
     */
    listenedAt: { type: Date },
    completedAt: { type: Date },

    /**
     * Which arm served this session, copied from the Impression so the outcome
     * is interpretable without a join.
     */
    arm: { type: String, enum: ["policy", "control"], default: "policy" },

    /** The user-local context, for the baseline cell this belongs to. */
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },

    /**
     * delta minus what this cell does without a recommendation. Null until a
     * baseline exists — an absent lift is honest, a zero would not be.
     */
    lift: { type: Number, default: null },
  },
  { timestamps: true }
);

/** Positive when the session helped. Null until the follow-up is answered. */
sessionOutcomeSchema.virtual("delta").get(function computeDelta() {
  if (this.moodAfter == null) return null;
  return this.moodAfter - this.moodBefore;
});

/**
 * Movement along the arousal axis, which is what most requests are actually
 * about: "wind me down" and "pick me up" both raise valence and move arousal in
 * opposite directions.
 */
sessionOutcomeSchema.virtual("arousalDelta").get(function computeArousalDelta() {
  if (this.arousalAfter == null || this.arousalBefore == null) return null;
  return this.arousalAfter - this.arousalBefore;
});

sessionOutcomeSchema.set("toJSON", { virtuals: true });
sessionOutcomeSchema.set("toObject", { virtuals: true });

sessionOutcomeSchema.index({ userId: 1, createdAt: -1 });
sessionOutcomeSchema.index({ sessionId: 1 }, { unique: true });

export { MOOD_VALENCE };
export default mongoose.model("SessionOutcome", sessionOutcomeSchema);
