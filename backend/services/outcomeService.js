import Recommendation from "../models/Recommendation.js";
import SessionOutcome from "../models/SessionOutcome.js";
import AppError from "../utils/AppError.js";
import { checkAndAwardBadges } from "./badgeService.js";
import { awardPoints } from "./pointsService.js";
import { recordSessionEffect } from "./songEffectService.js";

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

/**
 * Records that the user played something from this session.
 *
 * Distinct from completing it: listening is worth acknowledging, but only the
 * after-rating produces the measurement the effect ledger is built from. The
 * award is keyed on the session, so replaying a track cannot pay twice.
 */
export const markSessionListened = async ({ userId, sessionId, socketManager }) => {
  const outcome = await SessionOutcome.findOneAndUpdate(
    { sessionId, userId, listenedAt: null },
    { listenedAt: new Date() },
    { new: true }
  );

  // Already recorded, or never started. Neither is an error worth surfacing —
  // the client fires this on every play.
  if (!outcome) return null;

  await awardPoints(userId, "THERAPY_SESSION_COMPLETED", socketManager, {
    entityKey: sessionId.toString(),
  });
  await checkAndAwardBadges(userId, socketManager);

  return outcome;
};

/**
 * Closes the loop: the single measurement that says whether this worked.
 *
 * Completing a session is also the only event that writes to the song-effect
 * ledger, which is what turns an individual rating into ranking evidence.
 */
export const completeSession = async ({ userId, sessionId, moodAfter, socketManager }) => {
  const outcome = await SessionOutcome.findOneAndUpdate(
    { sessionId, userId },
    { moodAfter, completedAt: new Date() },
    { new: true }
  );

  if (!outcome) throw AppError.notFound("Session not started");

  await recordSessionEffect({
    songIds: outcome.songsPlayed,
    moodBefore: outcome.moodBefore,
    moodAfter,
  });

  // The behaviour the reward table now exists to encourage. Keyed on the
  // session, so re-submitting a rating cannot pay twice.
  await awardPoints(userId, "SESSION_MEASURED", socketManager, {
    entityKey: sessionId.toString(),
  });
  await checkAndAwardBadges(userId, socketManager);

  return outcome;
};

export const getRecentOutcomes = (userId, limit = 20) =>
  SessionOutcome.find({ userId, moodAfter: { $ne: null } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

export const deleteAllOutcomes = (userId) => SessionOutcome.deleteMany({ userId });
