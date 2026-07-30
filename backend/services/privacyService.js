import ListeningFeedback from "../models/ListeningFeedback.js";
import MoodEntry from "../models/MoodEntry.js";
import Playlist from "../models/Playlist.js";
import Recommendation from "../models/Recommendation.js";
import SessionOutcome from "../models/SessionOutcome.js";
import Gamification from "../models/Gamification.js";
import { UserBadge } from "../models/Badge.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";

/**
 * Everything the app stores about one person, in one document.
 *
 * Mood history is special-category data under GDPR Art. 9 and India's DPDP Act;
 * both require that a user can obtain and erase it. Neither was possible before.
 */
export const exportUserData = async (userId) => {
  const [user, moods, feedback, outcomes, playlists, recommendations, gamification, badges] =
    await Promise.all([
      User.findById(userId).lean(),
      MoodEntry.find({ userId }).sort({ recordedAt: 1 }).lean(),
      ListeningFeedback.find({ userId }).populate("musicId", "title artist genre").lean(),
      SessionOutcome.find({ userId }).lean(),
      Playlist.find({ $or: [{ userId }, { collaborators: userId }] }).lean(),
      Recommendation.find({ userId }).sort({ generatedAt: 1 }).lean(),
      Gamification.findOne({ userId }).lean(),
      UserBadge.find({ userId }).populate("badgeId", "name description").lean(),
    ]);

  if (!user) throw AppError.notFound("User not found");

  return {
    exportedAt: new Date().toISOString(),
    format: "zenova-export-v1",
    account: {
      id: user._id,
      name: user.name,
      email: user.email,
      preferences: user.preferences,
      joinedAt: user.createdAt,
    },
    moodHistory: moods.map(({ mood, context, source, intensity, recordedAt }) => ({
      mood,
      context,
      source,
      intensity,
      recordedAt,
    })),
    songFeedback: feedback.map(({ signal, genre, moodAtTime, musicId, createdAt }) => ({
      signal,
      genre,
      moodAtTime,
      song: musicId ? `${musicId.title} — ${musicId.artist}` : null,
      createdAt,
    })),
    sessionOutcomes: outcomes.map(({ moodBefore, moodAfter, detectedMood, createdAt }) => ({
      moodBefore,
      moodAfter,
      detectedMood,
      createdAt,
    })),
    playlists: playlists.map(({ name, songs, createdAt }) => ({
      name,
      createdAt,
      songs: songs.map((song) => `${song.title} — ${song.artist}`),
    })),
    recommendationSessions: recommendations.length,
    progress: gamification
      ? {
          totalPoints: gamification.totalPoints,
          level: gamification.level,
          currentStreak: gamification.currentStreak,
          longestStreak: gamification.longestStreak,
        }
      : null,
    badges: badges.filter((b) => b.badgeId).map(({ badgeId, earnedAt }) => ({
      name: badgeId.name,
      description: badgeId.description,
      earnedAt,
    })),
  };
};

/**
 * Erases the user's wellbeing data while leaving the account usable.
 * For people who want a clean slate without losing their playlists.
 */
export const deleteWellbeingData = async (userId) => {
  const [moods, feedback, outcomes, recommendations] = await Promise.all([
    MoodEntry.deleteMany({ userId }),
    ListeningFeedback.deleteMany({ userId }),
    SessionOutcome.deleteMany({ userId }),
    Recommendation.deleteMany({ userId }),
  ]);

  return {
    moodEntries: moods.deletedCount,
    songFeedback: feedback.deletedCount,
    sessionOutcomes: outcomes.deletedCount,
    recommendationSessions: recommendations.deletedCount,
  };
};

/**
 * Full account erasure.
 *
 * Playlists the user owns are removed; playlists they merely collaborated on
 * survive with their membership stripped, so deleting your account cannot
 * destroy someone else's data.
 */
export const deleteAccount = async (userId) => {
  const wellbeing = await deleteWellbeingData(userId);

  const [ownedPlaylists] = await Promise.all([
    Playlist.deleteMany({ userId }),
    Playlist.updateMany({ collaborators: userId }, { $pull: { collaborators: userId } }),
    Gamification.deleteOne({ userId }),
    UserBadge.deleteMany({ userId }),
  ]);

  const deleted = await User.findByIdAndDelete(userId);
  if (!deleted) throw AppError.notFound("User not found");

  return { ...wellbeing, playlists: ownedPlaylists.deletedCount, account: 1 };
};
