import PointAward from "../models/PointAward.js";
import logger from "../utils/logger.js";

/** Awards older than this are stale; nobody wants yesterday's toast today. */
const REPLAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** More than this and the client gets a single summary instead of a list. */
const MAX_REPLAYED = 10;

/**
 * Marks an award as delivered, but only if it really was.
 *
 * `emitToUser` writes into a room, so it succeeds silently when the room is
 * empty. The login bonus is granted inside POST /auth/login, several hundred
 * milliseconds before the client opens its socket, so it was always emitted
 * into an empty room and the user never saw it.
 */
export const recordAwardDelivery = async (awardId, delivered) => {
  if (!awardId || !delivered) return;

  try {
    await PointAward.updateOne({ _id: awardId }, { notifiedAt: new Date() });
  } catch (error) {
    // Delivery bookkeeping must never fail the award itself.
    logger.warn("could not mark award as notified", { detail: error.message });
  }
};

/**
 * Replays awards granted while the user had nothing connected.
 *
 * Called once per connection. Marking them notified before emitting means a
 * second tab opening at the same moment does not produce a duplicate toast; the
 * cost of that ordering is that an award can be lost if the socket dies in the
 * same instant, which is the right trade against showing it twice.
 */
export const flushPendingAwards = async (userId, socketManager) => {
  const since = new Date(Date.now() - REPLAY_WINDOW_MS);

  const pending = await PointAward.find({
    userId,
    notifiedAt: null,
    awardedAt: { $gte: since },
  })
    .sort({ awardedAt: 1 })
    .limit(MAX_REPLAYED + 1)
    .lean();

  // Everything in the window is settled, including the overflow beyond the
  // replay limit — those points are already in the total, only the toast is
  // being suppressed.
  await PointAward.updateMany(
    { userId, notifiedAt: null, awardedAt: { $gte: since } },
    { notifiedAt: new Date() }
  );

  if (pending.length === 0) return;

  const totalPoints = pending.reduce((sum, award) => sum + award.points, 0);

  socketManager.emitToUser(userId, "awards_missed", {
    points: totalPoints,
    awards: pending.slice(0, MAX_REPLAYED).map(({ action, points }) => ({
      action,
      points,
    })),
    truncated: pending.length > MAX_REPLAYED,
  });
};
