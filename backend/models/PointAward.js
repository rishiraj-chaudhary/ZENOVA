import mongoose from "mongoose";

/**
 * One granted award, recorded so it cannot be granted twice.
 *
 * Points were previously fire-and-forget increments, which made them trivially
 * farmable: creating and deleting the same playlist, or logging out and back
 * in, paid every time. Recording each award against the entity that earned it
 * turns the unique index into the anti-farming mechanism.
 *
 * It also gives weekly and monthly leaderboards something real to aggregate —
 * they previously had period keys but no per-period data, so both boards showed
 * all-time totals.
 */
const pointAwardSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  action: { type: String, required: true },

  /**
   * What was rewarded. A playlist id for a creation, a session id for a
   * completed session, a day key for the login bonus. Two awards with the same
   * key are the same award.
   */
  entityKey: { type: String, required: true },

  points: { type: Number, required: true },
  awardedAt: { type: Date, default: Date.now },
});

// The anti-replay constraint: one award per user per action per entity.
pointAwardSchema.index({ userId: 1, action: 1, entityKey: 1 }, { unique: true });
// Period leaderboards aggregate over this.
pointAwardSchema.index({ awardedAt: -1, userId: 1 });

export default mongoose.model("PointAward", pointAwardSchema);
