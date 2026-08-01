import mongoose from "mongoose";

/**
 * One served candidate, with the probability it was served with.
 *
 * This is the substrate for off-policy evaluation: with a logged propensity,
 * every past session can be replayed to ask "would a different policy have done
 * better?" — forever. Without it, history is a record of what happened and
 * nothing more, and no amount of later work can recover the missing
 * probabilities. Every session that runs before this collection exists is
 * permanently lost as evaluation data, which is why it lands first.
 *
 * Shaped on PointAward deliberately: append-only, one row per event, a unique
 * index that makes replay a conflict rather than a duplicate, and the same
 * aggregation idiom the leaderboard already uses.
 */
const impressionSchema = new mongoose.Schema({
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

  /** The recommendation this candidate was served in. */
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recommendation",
    required: true,
  },

  /** Rank in the served list, 0-based. Position bias is real and measurable. */
  position: { type: Number, required: true },

  /**
   * P(this candidate | context, policy) at serve time.
   *
   * The current ranker is deterministic, so this is 1/n. Logged anyway — the
   * value is in never having to backfill, and in the estimators being written
   * against a field that has always been there.
   */
  propensity: { type: Number, required: true, min: 0, max: 1 },

  /** Which policy produced it, so a replay knows what it is comparing against. */
  policyVersion: { type: String, required: true },

  /** Randomized control or the live policy — see BaselineCell. */
  arm: { type: String, enum: ["policy", "control"], default: "policy" },

  /**
   * The context the decision was made in, denormalised so evaluation does not
   * have to reconstruct it from three collections and a timezone.
   */
  context: {
    startingMood: { type: Number, min: 1, max: 5 },
    detectedMood: { type: String },
    hourOfDay: { type: Number, min: 0, max: 23 },
    dayOfWeek: { type: Number, min: 0, max: 6 },
  },

  servedAt: { type: Date, default: Date.now },
});

// Replaying a recommendation must conflict rather than double-count.
impressionSchema.index({ sessionId: 1, musicId: 1 }, { unique: true });
// The evaluation scan, and the per-user privacy sweep.
impressionSchema.index({ userId: 1, servedAt: -1 });
// Off-policy evaluation reads by policy over a window.
impressionSchema.index({ policyVersion: 1, servedAt: -1 });

export default mongoose.model("Impression", impressionSchema);
