import Gamification from "../models/Gamification.js";
import { getUserBadges } from "./badgeService.js";

const EMPTY_STATS = {
  points: 0,
  level: 1,
  streak: 0,
  longestStreak: 0,
  playlistsShared: 0,
  playlistsCreated: 0,
  songsAdded: 0,
  dailyLogins: 0,
};

/** Flattens the Gamification document into the shape the client renders. */
export const getUserStats = async (userId) => {
  const [stats, badges] = await Promise.all([
    Gamification.findOne({ userId }).lean(),
    getUserBadges(userId),
  ]);

  if (!stats) return { ...EMPTY_STATS, badges };

  return {
    points: stats.totalPoints,
    level: stats.level,
    streak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    playlistsShared: stats.playlistsShared,
    playlistsCreated: stats.playlistsCreated,
    songsAdded: stats.songsAdded,
    dailyLogins: stats.dailyLogins,
    badges,
  };
};
