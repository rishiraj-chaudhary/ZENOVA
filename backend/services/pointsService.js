import { LEVELS, POINTS } from "../config/gamification.js";
import Gamification from "../models/Gamification.js";
import logger from "../utils/logger.js";
import { scheduleLeaderboardRefresh } from "./leaderboardService.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;

/** Counters incremented alongside points, keyed by action. */
const ACTION_COUNTERS = {
  PLAYLIST_SHARED: "playlistsShared",
  PLAYLIST_CREATED: "playlistsCreated",
  SONG_ADDED: "songsAdded",
  DAILY_LOGIN: "dailyLogins",
};

export const calculateLevel = (totalPoints) =>
  LEVELS.reduce(
    (highest, level) => (totalPoints >= level.minPoints ? level.level : highest),
    1
  );

/**
 * Concurrent upserts on the same missing document can both pass the existence
 * check and race to insert, which the unique index on userId rejects with
 * E11000. Retrying once is sufficient: by then the document exists, so the
 * retry takes the update path.
 */
const upsertStats = async (userId, update) => {
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };

  try {
    return await Gamification.findOneAndUpdate({ userId }, update, options);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY) throw error;
    return Gamification.findOneAndUpdate({ userId }, update, options);
  }
};

const emit = (socketManager, userId, event, payload) => {
  socketManager?.emitToUser?.(userId, event, payload);
};

/**
 * Awards points for an action.
 *
 * The increment is a single atomic `$inc`, not a read-modify-write. The previous
 * implementation loaded the document, mutated it in memory and saved it, so
 * concurrent awards clobbered each other — ten simultaneous awards persisted
 * one. Since two rapid playlist actions overlap in practice, scores, counters,
 * leaderboard ranks and badge thresholds were all silently wrong.
 */
export const awardPoints = async (userId, action, socketManager) => {
  const normalizedAction = action.toUpperCase();
  const points = POINTS[normalizedAction] ?? 0;
  const counter = ACTION_COUNTERS[normalizedAction];

  const stats = await upsertStats(userId, {
    $inc: {
      totalPoints: points,
      ...(counter && { [counter]: 1 }),
    },
  });

  // Level is a pure function of the authoritative post-increment total, so it
  // is derived rather than incremented. `$max` keeps it monotonic under
  // concurrency: a slower writer can never lower a level a faster one set.
  const level = calculateLevel(stats.totalPoints);
  const leveledUp = level > stats.level;

  if (leveledUp) {
    await Gamification.updateOne({ userId }, { $max: { level } });
  }

  emit(socketManager, userId, "points_awarded", {
    points,
    action: normalizedAction,
    totalPoints: stats.totalPoints,
    level,
    leveledUp,
  });

  if (leveledUp) {
    emit(socketManager, userId, "level_up", { level, totalPoints: stats.totalPoints });
  }

  // All three boards read the same stats, so all three stay current.
  scheduleLeaderboardRefresh("alltime");
  scheduleLeaderboardRefresh("monthly");
  scheduleLeaderboardRefresh("weekly");

  return { points, totalPoints: stats.totalPoints, level, leveledUp };
};

const daysBetween = (later, earlier) =>
  Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);

/** Missing this many days or fewer is forgiven once per grace period. */
const STREAK_GRACE_DAYS = 2;
const GRACE_COOLDOWN_DAYS = 14;

const graceAvailable = (stats, now) =>
  !stats.lastGraceUsedAt ||
  daysBetween(now, stats.lastGraceUsedAt) >= GRACE_COOLDOWN_DAYS;

/** Decides the next streak state from the current one. Pure, so it is testable. */
const nextStreakState = (stats, now) => {
  const isFirstActivity = !stats.lastActivity || stats.currentStreak === 0;
  const elapsedDays = isFirstActivity ? null : daysBetween(now, stats.lastActivity);

  if (isFirstActivity) return { currentStreak: 1, graceUsed: false };
  if (elapsedDays === 0) return { currentStreak: stats.currentStreak, graceUsed: false };
  if (elapsedDays === 1) return { currentStreak: stats.currentStreak + 1, graceUsed: false };

  const withinGrace = elapsedDays <= STREAK_GRACE_DAYS + 1;
  if (withinGrace && graceAvailable(stats, now)) {
    return { currentStreak: stats.currentStreak + 1, graceUsed: true };
  }

  return { currentStreak: 1, graceUsed: false };
};

/**
 * Advances the daily streak. Same-day activity is a no-op, the next calendar
 * day extends the streak, and a longer gap resets it.
 *
 * A short gap is forgiven once per fortnight. In a wellbeing context a broken
 * streak lands as personal failure at exactly the moment someone was already
 * struggling — the grace period keeps the habit loop without that penalty.
 *
 * The decision depends on current state, so it cannot be a single atomic
 * operator. Instead the write is guarded on the `lastActivity` value that was
 * read: if a concurrent call already advanced the streak, this update matches
 * nothing and is skipped, which is correct because the streak should advance
 * at most once per day.
 */
export const updateStreak = async (userId, socketManager) => {
  const stats = await upsertStats(userId, { $setOnInsert: { currentStreak: 0 } });
  const now = new Date();

  const { currentStreak, graceUsed } = nextStreakState(stats, now);

  const result = await Gamification.updateOne(
    { userId, lastActivity: stats.lastActivity ?? null },
    {
      $set: {
        currentStreak,
        lastActivity: now,
        ...(graceUsed && { lastGraceUsedAt: now }),
      },
      $max: { longestStreak: currentStreak },
    }
  );

  if (result.matchedCount === 0) {
    logger.debug("streak already advanced by a concurrent request", {
      userId: userId.toString(),
    });
    return stats.currentStreak;
  }

  emit(socketManager, userId, "streak_updated", {
    currentStreak,
    longestStreak: Math.max(stats.longestStreak ?? 0, currentStreak),
    graceUsed,
  });

  return currentStreak;
};

export { nextStreakState };
