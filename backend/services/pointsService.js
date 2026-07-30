import { LEVELS, POINTS } from "../config/gamification.js";
import Gamification from "../models/Gamification.js";
import { scheduleLeaderboardRefresh } from "./leaderboardService.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const findOrCreateStats = async (userId) =>
  (await Gamification.findOne({ userId })) ?? new Gamification({ userId });

const emit = (socketManager, userId, event, payload) => {
  socketManager?.emitToUser?.(userId, event, payload);
};

export const awardPoints = async (userId, action, socketManager) => {
  const normalizedAction = action.toUpperCase();
  const points = POINTS[normalizedAction] ?? 0;

  const stats = await findOrCreateStats(userId);
  const previousLevel = stats.level;

  stats.totalPoints += points;
  stats.level = calculateLevel(stats.totalPoints);

  const counter = ACTION_COUNTERS[normalizedAction];
  if (counter) stats[counter] = (stats[counter] ?? 0) + 1;

  await stats.save();

  const leveledUp = stats.level > previousLevel;

  emit(socketManager, userId, "points_awarded", {
    points,
    action: normalizedAction,
    totalPoints: stats.totalPoints,
    level: stats.level,
    leveledUp,
  });

  if (leveledUp) {
    emit(socketManager, userId, "level_up", {
      level: stats.level,
      totalPoints: stats.totalPoints,
    });
  }

  // All three boards read the same stats, so all three stay current.
  scheduleLeaderboardRefresh("alltime");
  scheduleLeaderboardRefresh("monthly");
  scheduleLeaderboardRefresh("weekly");

  return { points, totalPoints: stats.totalPoints, level: stats.level, leveledUp };
};

const daysBetween = (later, earlier) =>
  Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);

/** Missing this many days or fewer is forgiven once per grace period. */
const STREAK_GRACE_DAYS = 2;
const GRACE_COOLDOWN_DAYS = 14;

const graceAvailable = (stats, now) =>
  !stats.lastGraceUsedAt ||
  daysBetween(now, stats.lastGraceUsedAt) >= GRACE_COOLDOWN_DAYS;

/**
 * Advances the daily streak. Same-day activity is a no-op, the next calendar
 * day extends the streak, and a longer gap resets it.
 *
 * A short gap is forgiven once per fortnight. In a wellbeing context a broken
 * streak lands as personal failure at exactly the moment someone was already
 * struggling — the grace period keeps the habit loop without that penalty.
 */
export const updateStreak = async (userId, socketManager) => {
  const stats = await findOrCreateStats(userId);
  const now = new Date();

  const isFirstActivity = !stats.lastActivity || stats.currentStreak === 0;
  const elapsedDays = isFirstActivity ? null : daysBetween(now, stats.lastActivity);
  let graceUsed = false;

  if (isFirstActivity) {
    stats.currentStreak = 1;
  } else if (elapsedDays === 1) {
    stats.currentStreak += 1;
  } else if (elapsedDays > 1) {
    if (elapsedDays <= STREAK_GRACE_DAYS + 1 && graceAvailable(stats, now)) {
      stats.currentStreak += 1;
      stats.lastGraceUsedAt = now;
      graceUsed = true;
    } else {
      stats.currentStreak = 1;
    }
  }

  stats.longestStreak = Math.max(stats.longestStreak ?? 0, stats.currentStreak);
  stats.lastActivity = now;
  await stats.save();

  emit(socketManager, userId, "streak_updated", {
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    graceUsed,
  });

  return stats.currentStreak;
};
