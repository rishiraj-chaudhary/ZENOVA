import Recommendation from "../models/Recommendation.js";
import SessionOutcome from "../models/SessionOutcome.js";
import AppError from "../utils/AppError.js";

/**
 * Opens an outcome record when a listening session starts.
 *
 * Upserted on sessionId so a user re-recording their starting mood updates the
 * existing record rather than creating a competing one.
 */
export const startSession = async ({ userId, sessionId, moodBefore }) => {
  const recommendation = await Recommendation.findOne({
    _id: sessionId,
    userId,
  }).lean();

  if (!recommendation) throw AppError.notFound("Session not found");

  return SessionOutcome.findOneAndUpdate(
    { sessionId },
    {
      userId,
      sessionId,
      moodBefore,
      detectedMood: recommendation.detectedMood,
      songsPlayed: recommendation.recommendedMusic.map((entry) => entry.musicId),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/** Closes the loop: the single measurement that says whether this worked. */
export const completeSession = async ({ userId, sessionId, moodAfter }) => {
  const outcome = await SessionOutcome.findOneAndUpdate(
    { sessionId, userId },
    { moodAfter, completedAt: new Date() },
    { new: true }
  );

  if (!outcome) throw AppError.notFound("Session not started");

  return outcome;
};

export const getRecentOutcomes = (userId, limit = 20) =>
  SessionOutcome.find({ userId, moodAfter: { $ne: null } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

export const deleteAllOutcomes = (userId) => SessionOutcome.deleteMany({ userId });
