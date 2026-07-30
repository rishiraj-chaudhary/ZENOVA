import Gamification from "../models/Gamification.js";
import Leaderboard from "../models/Leaderboard.js";

const LEADERBOARD_SIZE = 100;
const REBUILD_INTERVAL_MS = 60 * 1000;

const lastRebuiltAt = new Map();

/**
 * Rebuilds a leaderboard from current gamification stats.
 *
 * Sorting and limiting happen inside the aggregation pipeline so MongoDB only
 * materialises the top N documents. The previous version loaded every
 * Gamification document, populated every referenced user, then sorted the whole
 * collection in JavaScript.
 */
export const updateLeaderboard = async (type = "alltime", period = "all") => {
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
export const scheduleLeaderboardRefresh = (type = "alltime", period) => {
  const resolvedPeriod = period ?? currentPeriod(type);
  const key = `${type}:${resolvedPeriod}`;
  const now = Date.now();

  if (now - (lastRebuiltAt.get(key) ?? 0) < REBUILD_INTERVAL_MS) return;
  lastRebuiltAt.set(key, now);

  updateLeaderboard(type, resolvedPeriod).catch((error) =>
    console.error("Leaderboard refresh failed:", error.message)
  );
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

export const getLeaderboard = async (requestedType = "alltime", requestedPeriod) => {
  const type = VALID_TYPES.has(requestedType) ? requestedType : "alltime";
  const period = requestedPeriod ?? currentPeriod(type);

  const leaderboard = await Leaderboard.findOne({ type, period }).lean();
  if (leaderboard) return leaderboard.entries;

  // First read of a new period: build on demand rather than return empty.
  return updateLeaderboard(type, period);
};
