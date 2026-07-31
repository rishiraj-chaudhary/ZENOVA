import mongoose from "mongoose";

/**
 * Cross-instance mutual exclusion for periodic work.
 *
 * The leaderboard refresh was throttled by an in-process Map, so N instances
 * meant N rebuilds per interval. A document with a TTL gives the same throttle
 * across every instance without adding Redis as a dependency.
 */
const taskLockSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  acquiredAt: { type: Date, default: Date.now },
  /** MongoDB removes the document at this time, releasing the lock. */
  expiresAt: { type: Date, required: true },
});

taskLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("TaskLock", taskLockSchema);
