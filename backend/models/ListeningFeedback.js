import mongoose from "mongoose";

/**
 * Explicit signal about a recommended song.
 *
 * This is what makes personalization real. The recommendation prompt has always
 * read `likes` and `skips` from the user profile, but nothing ever wrote them —
 * so every request was generated as if the user had no history at all.
 */
const listeningFeedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    musicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MusicResource",
      required: true,
    },

    /** Which recommendation session produced this song. */
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "Recommendation" },

    signal: {
      type: String,
      enum: ["liked", "skipped", "saved"],
      required: true,
    },

    /** Denormalised so taste aggregation avoids a join per song. */
    genre: { type: String },
    moodAtTime: { type: String },
  },
  { timestamps: true }
);

// One standing opinion per user per song; re-rating overwrites via upsert.
listeningFeedbackSchema.index({ userId: 1, musicId: 1 }, { unique: true });
listeningFeedbackSchema.index({ userId: 1, signal: 1 });

export default mongoose.model("ListeningFeedback", listeningFeedbackSchema);
