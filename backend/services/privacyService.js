import ListeningFeedback from "../models/ListeningFeedback.js";
import Leaderboard from "../models/Leaderboard.js";
import PlaylistInvitation from "../models/PlaylistInvitation.js";
import PointAward from "../models/PointAward.js";
import RefreshToken from "../models/RefreshToken.js";
import MoodEntry from "../models/MoodEntry.js";
import Playlist from "../models/Playlist.js";
import Recommendation from "../models/Recommendation.js";
import SessionOutcome from "../models/SessionOutcome.js";
import Gamification from "../models/Gamification.js";
import { UserBadge } from "../models/Badge.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";
import { withTransaction } from "../utils/withTransaction.js";

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
const eraseWellbeing = async (userId, session) => {
  const options = session ? { session } : {};

  const [moods, feedback, outcomes, recommendations] = await Promise.all([
    MoodEntry.deleteMany({ userId }, options),
    ListeningFeedback.deleteMany({ userId }, options),
    SessionOutcome.deleteMany({ userId }, options),
    Recommendation.deleteMany({ userId }, options),
  ]);

  // Counters derived from the records above are the same data in a different
  // shape — "you have checked in 40 times" reconstructs a history the user just
  // asked to erase. The points those actions earned are left alone.
  await Gamification.updateOne(
    { userId },
    { $set: { checkInDays: 0, measuredSessions: 0, therapySessions: 0 } },
    options
  );

  return {
    moodEntries: moods.deletedCount,
    songFeedback: feedback.deletedCount,
    sessionOutcomes: outcomes.deletedCount,
    recommendationSessions: recommendations.deletedCount,
  };
};

export const deleteWellbeingData = (userId) =>
  withTransaction((session) => eraseWellbeing(userId, session));

/**
 * Full account erasure.
 *
 * Playlists the user owns are removed; playlists they merely collaborated on
 * survive with their membership stripped, so deleting your account cannot
 * destroy someone else's data.
 */
export const deleteAccount = (userId) =>
  withTransaction(async (session) => {
    const options = session ? { session } : {};

    const wellbeing = await eraseWellbeing(userId, session);

    const [ownedPlaylists] = await Promise.all([
      Playlist.deleteMany({ userId }, options),
      Playlist.updateMany(
        { collaborators: userId },
        { $pull: { collaborators: userId } },
        options
      ),
      Gamification.deleteOne({ userId }, options),
      UserBadge.deleteMany({ userId }, options),

      // Every other collection keyed to this person. "Removes your account and
      // all history" left the award ledger, live refresh tokens, invitations
      // naming them, and their rows in cached leaderboards — the last of which
      // would keep showing a deleted user's name on a public board.
      PointAward.deleteMany({ userId }, options),
      RefreshToken.deleteMany({ userId }, options),
      PlaylistInvitation.deleteMany(
        { $or: [{ invitedUserId: userId }, { invitedByUserId: userId }] },
        options
      ),
      Leaderboard.updateMany(
        { "entries.userId": userId },
        { $pull: { entries: { userId } } },
        options
      ),
    ]);

    const deleted = await User.findByIdAndDelete(userId, options);
    if (!deleted) throw AppError.notFound("User not found");

    return { ...wellbeing, playlists: ownedPlaylists.deletedCount, account: 1 };
  });
