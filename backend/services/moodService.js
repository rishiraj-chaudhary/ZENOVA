import MoodEntry from "../models/MoodEntry.js";
import User from "../models/user.js";
import logger from "../utils/logger.js";

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_CONTEXT_LENGTH = 200;

const truncate = (text = "", maxLength = MAX_CONTEXT_LENGTH) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

const hasMoodConsent = async (userId) => {
  const user = await User.findById(userId).select("consent").lean();
  return Boolean(user?.consent?.moodTracking);
};

/**
 * Records a mood observation, if the user has consented to mood tracking.
 *
 * Mood is special-category health data, so the consent check is enforced at the
 * write itself rather than only at the UI — no code path can persist it by
 * accident.
 *
 * Failures are logged and swallowed: mood history is analytics, and losing one
 * entry must never fail the conversation the user is actually having.
 */
export const recordMood = async ({ userId, mood, context, source, intensity }) => {
  if (!userId || !mood) return null;

  try {
    if (!(await hasMoodConsent(userId))) return null;

    return await MoodEntry.create({
      userId,
      mood,
      context: truncate(context),
      source,
      intensity,
    });
  } catch (error) {
    logger.error("Failed to record mood:", error.message);
    return null;
  }
};

export const getRecentMoods = (userId, limit = DEFAULT_HISTORY_LIMIT) =>
  MoodEntry.find({ userId }).sort({ recordedAt: -1 }).limit(limit).lean();

export const getMoodsSince = (userId, since) =>
  MoodEntry.find({ userId, recordedAt: { $gte: since } })
    .sort({ recordedAt: 1 })
    .lean();

export const countMoods = (userId) => MoodEntry.countDocuments({ userId });

export const getMoodHistoryPage = async (userId, { page = 1, limit = 30 } = {}) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * safeLimit;

  const [entries, total] = await Promise.all([
    MoodEntry.find({ userId })
      .sort({ recordedAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    MoodEntry.countDocuments({ userId }),
  ]);

  return {
    entries,
    pagination: {
      page: Math.max(page, 1),
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

export const deleteAllMoods = (userId) => MoodEntry.deleteMany({ userId });
