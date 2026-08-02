import Recommendation from "../models/Recommendation.js";
import SessionOutcome from "../models/SessionOutcome.js";
import AppError from "../utils/AppError.js";
import { checkAndAwardBadges } from "./badgeService.js";
import { hasMoodConsent } from "./consentService.js";
import { awardPoints } from "./pointsService.js";
import { recordSessionEffect } from "./songEffectService.js";
import Impression from "../models/Impression.js";
import { contextOf, liftOf, recordBaselineObservation } from "./baselineService.js";

/**
 * Opens an outcome record when a listening session starts.
 *
 * Upserted on sessionId so a user re-recording their starting mood updates the
 * existing record rather than creating a competing one.
 */
export const startSession = async ({
  userId,
  sessionId,
  moodBefore,
  arousalBefore = null,
  timeZone,
}) => {
  // moodBefore is self-reported health data. Enforced here rather than in the
  // UI so no caller can persist it by accident.
  if (!(await hasMoodConsent(userId))) {
    throw AppError.forbidden(
      "Mood tracking consent is required to record how you are feeling"
    );
  }

  const recommendation = await Recommendation.findOne({
    _id: sessionId,
    userId,
  }).lean();

  if (!recommendation) throw AppError.notFound("Session not found");

  // The arm was decided when the recommendation was served; copy it here so an
  // outcome can be interpreted without joining back to the impressions.
  const impression = await Impression.findOne({ sessionId }).select("arm").lean();
  const { hourOfDay, dayOfWeek } = contextOf(new Date(), timeZone);

  return SessionOutcome.findOneAndUpdate(
    { sessionId },
    {
      userId,
      sessionId,
      moodBefore,
      detectedMood: recommendation.detectedMood,
      songsPlayed: recommendation.recommendedMusic.map((entry) => entry.musicId),
      arousalBefore,
      arm: impression?.arm ?? "policy",
      hourOfDay,
      dayOfWeek,
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
export const completeSession = async ({
  userId,
  sessionId,
  moodAfter,
  arousalAfter = null,
  socketManager,
}) => {
  if (!(await hasMoodConsent(userId))) {
    throw AppError.forbidden(
      "Mood tracking consent is required to record how you are feeling"
    );
  }

  const outcome = await SessionOutcome.findOneAndUpdate(
    { sessionId, userId },
    { moodAfter, arousalAfter, completedAt: new Date() },
    { new: true }
  );

  if (!outcome) throw AppError.notFound("Session not started");

  await recordSessionEffect({
    songIds: outcome.songsPlayed,
    moodBefore: outcome.moodBefore,
    moodAfter,
    arousalBefore: outcome.arousalBefore ?? null,
  });

  // The causal half. A control-arm session is evidence about what the *day*
  // does; a policy session is evidence about what the *song* did, but only
  // once the day has been subtracted from it.
  const delta = moodAfter - outcome.moodBefore;

  if (outcome.arm === "control") {
    await recordBaselineObservation({
      startingMood: outcome.moodBefore,
      hourOfDay: outcome.hourOfDay,
      dayOfWeek: outcome.dayOfWeek,
      delta,
      source: "randomized",
    });
  }

  const { lift } = await liftOf({
    delta,
    startingMood: outcome.moodBefore,
    hourOfDay: outcome.hourOfDay,
    dayOfWeek: outcome.dayOfWeek,
  });

  outcome.lift = lift;
  await outcome.save();

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
