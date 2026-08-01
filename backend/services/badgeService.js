import { BADGES } from "../config/gamification.js";
import { Badge, UserBadge } from "../models/Badge.js";
import Gamification from "../models/Gamification.js";
import Playlist from "../models/Playlist.js";
import logger from "../utils/logger.js";

/**
 * Reads every value a badge requirement can be measured against, in one pass.
 *
 * Requirements were previously evaluated one badge at a time, each issuing its
 * own query — so N badges meant N round-trips even though they all read the
 * same handful of numbers.
 */
const loadProgressSnapshot = async (userId, stats) => {
  const playlistCount = await Playlist.countDocuments({ userId });

  // Every key here must have a matching badge requirement type, and every
  // requirement type must appear here — a requirement with no key is a badge
  // nobody can ever earn.
  return {
    playlist_count: playlistCount,
    streak_days: stats.currentStreak ?? 0,
    playlists_shared: stats.playlistsShared ?? 0,
    daily_logins: stats.dailyLogins ?? 0,
    songs_added: stats.songsAdded ?? 0,
    measured_sessions: stats.measuredSessions ?? 0,
    therapy_sessions: stats.therapySessions ?? 0,
    check_in_days: stats.checkInDays ?? 0,
  };
};

const meetsRequirement = (badge, snapshot) => {
  const { type, value } = badge.requirement;
  const progress = snapshot[type];

  if (progress === undefined) {
    logger.warn(`Unknown badge requirement type: ${type}`);
    return false;
  }

  return progress >= value;
};

const notifyBadgeEarned = (socketManager, userId, badge, earnedAt) => {
  socketManager?.emitToUser?.(userId, "badge_earned", {
    badge: {
      id: badge._id,
      name: badge.name,
      description: badge.description,
      rarity: badge.rarity,
      icon: badge.icon,
      category: badge.category,
    },
    earnedAt,
  });
};

/**
 * Evaluates every active badge against the user's current progress and awards
 * any newly earned ones. Returns the number awarded.
 */
export const checkAndAwardBadges = async (userId, socketManager) => {
  const stats = await Gamification.findOne({ userId }).lean();
  if (!stats) return 0;

  const [activeBadges, ownedBadges] = await Promise.all([
    Badge.find({ isActive: true }).lean(),
    UserBadge.find({ userId }).select("badgeId").lean(),
  ]);

  const ownedBadgeIds = new Set(ownedBadges.map((entry) => entry.badgeId.toString()));
  const snapshot = await loadProgressSnapshot(userId, stats);

  const newlyEarned = activeBadges.filter(
    (badge) =>
      !ownedBadgeIds.has(badge._id.toString()) && meetsRequirement(badge, snapshot)
  );

  if (newlyEarned.length === 0) return 0;

  const earnedAt = new Date();

  // ordered:false lets the unique {userId,badgeId} index absorb a concurrent
  // duplicate award instead of failing the whole batch.
  try {
    await UserBadge.insertMany(
      newlyEarned.map((badge) => ({ userId, badgeId: badge._id, earnedAt })),
      { ordered: false }
    );
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  await Gamification.updateOne(
    { userId },
    { $addToSet: { badges: { $each: newlyEarned.map((badge) => badge._id) } } }
  );

  newlyEarned.forEach((badge) =>
    notifyBadgeEarned(socketManager, userId, badge, earnedAt)
  );

  return newlyEarned.length;
};

export const getUserBadges = async (userId) => {
  const userBadges = await UserBadge.find({ userId })
    .populate("badgeId")
    .sort({ earnedAt: -1 })
    .lean();

  return userBadges
    .filter((entry) => entry.badgeId)
    .map((entry) => ({
      ...entry.badgeId,
      earnedAt: entry.earnedAt,
      isDisplayed: entry.isDisplayed,
    }));
};

/** Idempotently seeds the badge catalogue defined in config/gamification.js. */
export const initializeDefaultBadges = async () => {
  try {
    // $set, not $setOnInsert: the catalogue in config is the source of truth,
    // and seeding it write-once meant every later edit — a reworded
    // description, a corrected requirement, a renamed level — was silently
    // ignored on any database that had already been seeded.
    await Badge.bulkWrite(
      BADGES.map((badge) => ({
        updateOne: {
          filter: { name: badge.name },
          update: {
            $set: {
              ...badge,
              icon: badge.icon ?? "/icons/badge-default.svg",
              pointsReward: badge.pointsReward ?? 0,
              isActive: true,
            },
          },
          upsert: true,
        },
      }))
    );

    // A badge dropped from the catalogue stays in the database — users who
    // earned it keep it — but must stop being offered, or it sits in the list
    // permanently unearnable.
    const retired = await Badge.updateMany(
      { name: { $nin: BADGES.map((badge) => badge.name) }, isActive: true },
      { $set: { isActive: false } }
    );

    if (retired.modifiedCount > 0) {
      logger.info("retired badges deactivated", { count: retired.modifiedCount });
    }
  } catch (error) {
    logger.error("Failed to initialize default badges:", error.message);
  }
};
