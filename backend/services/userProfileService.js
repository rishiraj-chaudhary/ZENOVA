import User from "../models/user.js";
import { getRecentMoods } from "./moodService.js";

const RECENT_MOOD_WINDOW = 10;

const GUEST_PROFILE = {
  isGuest: true,
  name: null,
  preferences: [],
  moodHistory: [],
  sessionHistory: [],
};

/**
 * Loads the context the AI prompts need. Guests and unknown ids resolve to an
 * empty profile so callers never branch on null.
 *
 * Mood history now comes from the MoodEntry collection rather than an array
 * embedded in the user document, and is bounded — an unbounded history would
 * grow the prompt without bound and eventually exceed the context window.
 */
export const loadTherapyProfile = async (userId) => {
  if (!userId || userId === "guest") return GUEST_PROFILE;

  const [user, moodHistory] = await Promise.all([
    User.findById(userId).select("name preferences sessionHistory").lean(),
    getRecentMoods(userId, RECENT_MOOD_WINDOW),
  ]);

  if (!user) return GUEST_PROFILE;

  return {
    isGuest: false,
    name: user.name,
    preferences: user.preferences ?? [],
    sessionHistory: user.sessionHistory ?? [],
    moodHistory,
  };
};

/**
 * Session history is analytics. Failures are logged and swallowed so a write
 * error never breaks the conversation the user is actually having.
 */
export const recordSession = async (userId, sessionType) => {
  try {
    await User.findByIdAndUpdate(userId, {
      $push: { sessionHistory: { sessionType, sessionDate: new Date() } },
      $set: { lastSessionDate: new Date() },
    });
  } catch (error) {
    console.error("Failed to record session:", error.message);
  }
};
