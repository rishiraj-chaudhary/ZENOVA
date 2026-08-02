import mongoose from "mongoose";

/**
 * One recorded mood observation.
 *
 * Previously an unbounded array inside the user document, which meant every
 * check-in rewrote the whole user record, the 16MB document ceiling was a real
 * limit, and there was no way to query or delete a single entry. As its own
 * collection it can be paged, aggregated, expired and deleted per-record.
 */
const moodEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mood: { type: String, required: true, lowercase: true, trim: true },

    /** Truncated snippet of what the user wrote, for recall in the UI. */
    context: { type: String, maxlength: 200 },

    source: {
      type: String,
      enum: ["chat", "check-in", "post-session"],
      default: "chat",
    },

    /** 1–5 self-reported intensity, only set by explicit check-ins. */
    intensity: { type: Number, min: 1, max: 5 },

  /**
   * The two-dimensional reading, added alongside the 1-5 scale rather than
   * replacing it.
   *
   * A single axis cannot distinguish "I need to be calmer" from "I need more
   * energy" — opposite prescriptions that produce identical input. Music maps
   * onto arousal far more naturally than onto a single goodness axis, so this
   * is the difference between a recommender that can act on the request and one
   * that can only guess at it.
   *
   * `valence` mirrors intensity for anything recorded before the grid existed;
   * `arousal` stays null there, and anything derived from it says so.
   */
  valence: { type: Number, min: 1, max: 5, default: null },
  arousal: { type: Number, min: 1, max: 5, default: null },

    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Every read is "this user's entries, newest first" or a date-bounded range.
moodEntrySchema.index({ userId: 1, recordedAt: -1 });

export default mongoose.model("MoodEntry", moodEntrySchema);
