import {
  DAILY_POINT_CAPS,
  LEVELS,
  POINTS,
  getLevelProgress,
} from "../config/gamification.js";
import Gamification from "../models/Gamification.js";
import PointAward from "../models/PointAward.js";
import { dayKey, daysBetweenKeys } from "../utils/dayKey.js";
import logger from "../utils/logger.js";
import { recordAwardDelivery } from "./awardInbox.js";
import { scheduleLeaderboardRefresh } from "./leaderboardService.js";

const DUPLICATE_KEY = 11000;

/** Counters incremented alongside points, keyed by action. */
const ACTION_COUNTERS = {
  PLAYLIST_SHARED: "playlistsShared",
  PLAYLIST_CREATED: "playlistsCreated",
  SONG_ADDED: "songsAdded",
  DAILY_LOGIN: "dailyLogins",
  DAILY_CHECK_IN: "checkInDays",
  SESSION_MEASURED: "measuredSessions",
  THERAPY_SESSION_COMPLETED: "therapySessions",
};

export const calculateLevel = (totalPoints) =>
  LEVELS.reduce(
    (highest, level) => (totalPoints >= level.minPoints ? level.level : highest),
    1
  );

/**
 * Concurrent upserts on the same missing document can both pass the existence
 * check and race to insert, which the unique index on userId rejects with
 * E11000. Retrying once is sufficient: by then the document exists.
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

/** Returns whether the user actually had a socket open to receive it. */
const emit = (socketManager, userId, event, payload) =>
  Boolean(socketManager?.emitToUser?.(userId, event, payload));

/**
 * Claims the right to award, exactly once, for this user/action/entity.
 *
 * The unique index is the anti-farming mechanism: a second attempt for the same
 * entity conflicts and is refused. Points used to be fire-and-forget
 * increments, so deleting and recreating a playlist — or logging out and back
 * in — paid every single time.
 */
const claimAward = async ({ userId, action, entityKey, points }) => {
  try {
    const award = await PointAward.create({ userId, action, entityKey, points });
    return award;
  } catch (error) {
    if (error.code === DUPLICATE_KEY) return null;
    throw error;
  }
};

/** Points granted for this action today, counted from the award ledger. */
const pointsAwardedToday = async (userId, action) => {
  const [totals] = await PointAward.aggregate([
    {
      $match: {
        userId,
        action,
        awardedAt: { $gte: new Date(`${dayKey()}T00:00:00.000Z`) },
      },
    },
    { $group: { _id: null, points: { $sum: "$points" } } },
  ]);

  return totals?.points ?? 0;
};

/**
 * Enforces the daily ceiling by claiming first and verifying after.
 *
 * Checking the total before claiming is a read-then-write: twenty concurrent
 * awards all observe the pre-write total, all pass, and the cap is ignored.
 * Inserting the claim first means each caller counts its own claim plus every
 * one that landed before it, so the callers over the line see it and withdraw.
 * Overshoot is bounded to a single award rather than unbounded.
 */
const withinDailyCap = async (userId, action, awardId) => {
  const cap = DAILY_POINT_CAPS[action];
  if (cap == null) return true;

  if ((await pointsAwardedToday(userId, action)) <= cap) return true;

  await PointAward.deleteOne({ _id: awardId });
  logger.debug("daily cap reached", { action });
  return false;
};

/** Level derivation, emission and leaderboard refresh — shared by every award. */
const applyAwardEffects = async (userId, action, points, stats, socketManager, awardId) => {
  // Level is a pure function of the authoritative post-increment total. $max
  // keeps it monotonic: a slower writer can never lower a level a faster one set.
  const level = calculateLevel(stats.totalPoints);
  const leveledUp = level > stats.level;

  if (leveledUp) await Gamification.updateOne({ userId }, { $max: { level } });

  const delivered = emit(socketManager, userId, "points_awarded", {
    points,
    action,
    totalPoints: stats.totalPoints,
    level,
    leveledUp,
    // Without this the client kept the progress it already had and applied the
    // new total to it, so the Achievements bar showed the new points against
    // the old level's thresholds until the page was reloaded.
    progress: getLevelProgress(stats.totalPoints),
  });

  // Undelivered awards stay flagged and are replayed on the next connection.
  await recordAwardDelivery(awardId, delivered);

  if (leveledUp) {
    emit(socketManager, userId, "level_up", { level, totalPoints: stats.totalPoints });
  }

  scheduleLeaderboardRefresh("alltime");
  scheduleLeaderboardRefresh("monthly");
  scheduleLeaderboardRefresh("weekly");

  return { awarded: true, points, totalPoints: stats.totalPoints, level, leveledUp };
};

const NOT_AWARDED = { awarded: false, points: 0 };

/**
 * Awards points for an action, at most once per entity and within the daily cap.
 *
 * `entityKey` identifies what is being rewarded — a playlist id, a session id,
 * a day key. Callers that pass none get a per-day key, which makes the action
 * once-daily rather than unlimited.
 */
export const awardPoints = async (userId, action, socketManager, { entityKey } = {}) => {
  const normalizedAction = action.toUpperCase();
  const points = POINTS[normalizedAction] ?? 0;
  const key = entityKey ?? dayKey();

  const award = await claimAward({
    userId,
    action: normalizedAction,
    entityKey: key,
    points,
  });
  if (!award) return NOT_AWARDED;

  if (!(await withinDailyCap(userId, normalizedAction, award._id))) {
    return NOT_AWARDED;
  }

  const counter = ACTION_COUNTERS[normalizedAction];
  const stats = await upsertStats(userId, {
    $inc: { totalPoints: points, ...(counter && { [counter]: 1 }) },
  });

  return applyAwardEffects(
    userId,
    normalizedAction,
    points,
    stats,
    socketManager,
    award._id
  );
};

/** Missing this many days or fewer is forgiven once per grace period. */
const STREAK_GRACE_DAYS = 2;
const GRACE_COOLDOWN_DAYS = 14;

const graceAvailable = (stats, todayKey) => {
  if (!stats.lastGraceUsedDay) return true;
  return daysBetweenKeys(todayKey, stats.lastGraceUsedDay) >= GRACE_COOLDOWN_DAYS;
};

/**
 * Decides the next streak state from the current one. Pure, so it is testable
 * without a clock or a database.
 */
export const nextStreakState = (stats, todayKey) => {
  const lastDay = stats.lastActivityDay;

  if (!lastDay || stats.currentStreak === 0) {
    return { currentStreak: 1, graceUsed: false, unchanged: false, reset: false };
  }

  const elapsed = daysBetweenKeys(todayKey, lastDay);

  // Already counted today. Nothing to record, and nothing to announce.
  if (elapsed <= 0) {
    return { currentStreak: stats.currentStreak, unchanged: true, graceUsed: false, reset: false };
  }

  if (elapsed === 1) {
    return {
      currentStreak: stats.currentStreak + 1,
      graceUsed: false,
      unchanged: false,
      reset: false,
    };
  }

  if (elapsed <= STREAK_GRACE_DAYS + 1 && graceAvailable(stats, todayKey)) {
    return {
      currentStreak: stats.currentStreak + 1,
      graceUsed: true,
      unchanged: false,
      reset: false,
    };
  }

  return { currentStreak: 1, graceUsed: false, unchanged: false, reset: true };
};

/**
 * Advances the daily streak.
 *
 * Compares calendar days rather than elapsed milliseconds: a 23:00 visit
 * followed by one at 08:00 is the next day, which the old duration arithmetic
 * scored as zero. A short gap is forgiven once a fortnight, because in a
 * wellbeing context a broken streak lands as personal failure at exactly the
 * moment someone was already struggling.
 */
export const updateStreak = async (userId, socketManager, { timeZone = "UTC" } = {}) => {
  const stats = await upsertStats(userId, { $setOnInsert: { currentStreak: 0 } });
  const todayKey = dayKey(new Date(), timeZone);

  const { currentStreak, graceUsed, unchanged, reset } = nextStreakState(stats, todayKey);

  // Nothing changed today, so no write and — importantly — no toast. The old
  // version emitted "Streak updated" on every app open.
  if (unchanged) return stats.currentStreak;

  const result = await Gamification.updateOne(
    { userId, lastActivityDay: stats.lastActivityDay ?? null },
    {
      $set: {
        currentStreak,
        lastActivityDay: todayKey,
        lastActivity: new Date(),
        ...(graceUsed && { lastGraceUsedDay: todayKey }),
      },
      $max: { longestStreak: currentStreak },
    }
  );

  if (result.matchedCount === 0) {
    logger.debug("streak already advanced by a concurrent request");
    return stats.currentStreak;
  }

  emit(socketManager, userId, "streak_updated", {
    currentStreak,
    longestStreak: Math.max(stats.longestStreak ?? 0, currentStreak),
    graceUsed,
    // Lets the client say "streak restarted" instead of congratulating someone
    // on the streak they just lost.
    reset,
  });

  return currentStreak;
};
