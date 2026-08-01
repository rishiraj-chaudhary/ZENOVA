import Gamification from "../models/Gamification.js";
import Leaderboard from "../models/Leaderboard.js";
import PointAward from "../models/PointAward.js";
import logger from "../utils/logger.js";
import { acquireLock } from "../utils/taskLock.js";

const LEADERBOARD_SIZE = 100;
const REBUILD_INTERVAL_MS = 60 * 1000;

/**
 * Rebuilds a leaderboard from current gamification stats.
 *
 * Sorting and limiting happen inside the aggregation pipeline so MongoDB only
 * materialises the top N documents. The previous version loaded every
 * Gamification document, populated every referenced user, then sorted the whole
 * collection in JavaScript.
 */
/** Inclusive start of the current ISO week / calendar month, in UTC. */
const periodStart = (type, now = new Date()) => {
  if (type === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  if (type === "weekly") {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    // ISO weeks start on Monday; getUTCDay() is 0 for Sunday.
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    return start;
  }

  return null;
};

/**
 * Ranks a bounded period by points actually earned within it.
 *
 * Weekly and monthly boards previously reused the all-time aggregation, so all
 * three tabs showed identical data: the period keys existed but nothing ever
 * scoped the query to them. Summing the award ledger is what makes a period
 * board mean anything.
 */
const buildPeriodEntries = async (type) => {
  const since = periodStart(type);

  return PointAward.aggregate([
    { $match: { awardedAt: { $gte: since } } },
    { $group: { _id: "$userId", totalPoints: { $sum: "$points" } } },
    { $sort: { totalPoints: -1 } },
    { $limit: LEADERBOARD_SIZE },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: "$user" },
    {
      $lookup: {
        from: "gamifications",
        localField: "_id",
        foreignField: "userId",
        as: "stats",
      },
    },
    { $unwind: { path: "$stats", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        username: "$user.name",
        totalPoints: 1,
        level: { $ifNull: ["$stats.level", 1] },
        currentStreak: { $ifNull: ["$stats.currentStreak", 0] },
        badgeCount: { $size: { $ifNull: ["$stats.badges", []] } },
      },
    },
  ]);
};

export const updateLeaderboard = async (type = "alltime", period = "all") => {
  if (type !== "alltime") {
    const periodEntries = await buildPeriodEntries(type);
    await Leaderboard.findOneAndUpdate(
      { type, period },
      { entries: periodEntries, lastUpdated: new Date() },
      { upsert: true, new: true }
    );
    return periodEntries;
  }

  const entries = await Gamification.aggregate([
    { $sort: { totalPoints: -1, level: -1, currentStreak: -1 } },
    { $limit: LEADERBOARD_SIZE },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$userId",
        username: "$user.name",
        totalPoints: 1,
        level: 1,
        currentStreak: 1,
        badgeCount: { $size: { $ifNull: ["$badges", []] } },
      },
    },
  ]);

  await Leaderboard.findOneAndUpdate(
    { type, period },
    { entries, lastUpdated: new Date() },
    { upsert: true, new: true }
  );

  return entries;
};

/**
 * Throttled rebuild for the hot path. A leaderboard up to a minute stale is
 * acceptable; rebuilding it on every single point award was not — that made
 * every playlist action pay for a full ranking pass.
 */
/**
 * Throttled rebuild for the hot path. A leaderboard up to a minute stale is
 * acceptable; rebuilding it on every single point award was not.
 *
 * The throttle is a database lock rather than an in-process Map, because the
 * latter throttled per instance — three instances meant three rebuilds per
 * interval, each a full ranking pass.
 */
export const scheduleLeaderboardRefresh = (type = "alltime", period) => {
  const resolvedPeriod = period ?? currentPeriod(type);
  const key = `leaderboard:${type}:${resolvedPeriod}`;

  // Fire-and-forget: the caller is a user request that must not wait on, or
  // fail because of, a background ranking refresh.
  acquireLock(key, REBUILD_INTERVAL_MS)
    .then((acquired) => {
      if (!acquired) return null;
      return updateLeaderboard(type, resolvedPeriod);
    })
    .catch((error) => logger.error("leaderboard refresh failed", { error: error.message }));
};

/**
 * ISO week / calendar month label for the current period, so weekly and
 * monthly boards write to a stable key. These types were previously accepted
 * as parameters with no code that ever produced them.
 */
export const currentPeriod = (type, now = new Date()) => {
  if (type === "monthly") {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  if (type === "weekly") {
    const target = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    // ISO-8601: week 1 is the week containing the first Thursday.
    target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  return "all";
};

const VALID_TYPES = new Set(["alltime", "weekly", "monthly"]);

export const getLeaderboard = async (requestedType = "alltime") => {
  const type = VALID_TYPES.has(requestedType) ? requestedType : "alltime";
  const period = currentPeriod(type);

  const leaderboard = await Leaderboard.findOne({ type, period }).lean();

  if (leaderboard) {
    // Served immediately, but a stale board triggers a rebuild for the next
    // reader. Refreshes were only ever scheduled when points were awarded, and
    // that path is rate-limited, so a board could stay stale indefinitely once
    // the system went quiet — a user's most recent points simply never showed.
    const age = Date.now() - new Date(leaderboard.updatedAt ?? 0).getTime();
    if (age > REBUILD_INTERVAL_MS) scheduleLeaderboardRefresh(type, period);

    return leaderboard.entries;
  }

  // First read of a new period: build on demand rather than return empty.
  return updateLeaderboard(type, period);
};
