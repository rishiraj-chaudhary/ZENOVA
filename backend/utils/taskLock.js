import TaskLock from "../models/TaskLock.js";

const DUPLICATE_KEY = 11000;

/**
 * Attempts to claim a named lock for a period.
 *
 * The unique index on `key` is the mutex: exactly one instance can insert, and
 * the rest get E11000 and back off. An expired lock is replaced rather than
 * blocking forever, so a crashed holder cannot deadlock the task.
 *
 * Returns true if the caller now holds the lock.
 */
export const acquireLock = async (key, ttlMs) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  try {
    const result = await TaskLock.updateOne(
      { key, expiresAt: { $lte: now } },
      { $set: { key, acquiredAt: now, expiresAt } },
      { upsert: true }
    );

    return result.upsertedCount > 0 || result.modifiedCount > 0;
  } catch (error) {
    // Another instance inserted first, which is the contended path, not a fault.
    if (error.code === DUPLICATE_KEY) return false;
    throw error;
  }
};

export const releaseLock = (key) => TaskLock.deleteOne({ key });
