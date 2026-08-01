import { getCrisisResources, EMERGENCY_NOTICE } from "../config/crisisResources.js";
import {
  buildMoodInsights,
  generateInsightNarrative,
} from "../services/moodInsightsService.js";
import { getMoodHistoryPage, recordMood } from "../services/moodService.js";
import { completeSession, startSession } from "../services/outcomeService.js";
import { recordFeedback, removeFeedback } from "../services/tasteService.js";
import { checkAndAwardBadges } from "../services/badgeService.js";
import { awardPoints } from "../services/pointsService.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";

export const logMood = asyncHandler(async (req, res) => {
  const { mood, intensity, context } = req.body;

  const entry = await recordMood({
    userId: req.user._id,
    mood,
    intensity,
    context,
    source: "check-in",
  });

  // Once per calendar day via the default entity key. Check-ins are what fill
  // the mood history the insights are drawn from.
  if (entry) {
    await awardPoints(req.user._id, "DAILY_CHECK_IN", req.socketManager);
    await checkAndAwardBadges(req.user._id, req.socketManager);
  }

  res.status(201).json(entry);
});

export const getMoodHistory = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;

  res.json(
    await getMoodHistoryPage(req.user._id, {
      page: Number(page) || 1,
      limit: Number(limit) || 30,
    })
  );
});

/**
 * The dashboard payload: computed statistics plus an AI-written reflection.
 * The narrative is optional — statistics render with or without it.
 */
export const getInsights = asyncHandler(async (req, res) => {
  const periodDays = Math.min(Number(req.query.periodDays) || 30, 365);

  const insights = await buildMoodInsights(req.user._id, { periodDays });
  const narrative = await generateInsightNarrative(insights);

  res.json({ ...insights, narrative });
});

export const submitSongFeedback = asyncHandler(async (req, res) => {
  const { musicId, signal, sessionId, moodAtTime } = req.body;

  const feedback = await recordFeedback({
    userId: req.user._id,
    musicId,
    signal,
    sessionId,
    moodAtTime,
  });

  res.status(201).json(feedback);
});

export const clearSongFeedback = asyncHandler(async (req, res) => {
  await removeFeedback({ userId: req.user._id, musicId: req.params.musicId });
  res.json({ message: "Feedback removed" });
});

export const beginListeningSession = asyncHandler(async (req, res) => {
  const { sessionId, moodBefore } = req.body;

  res.status(201).json(
    await startSession({ userId: req.user._id, sessionId, moodBefore })
  );
});

export const finishListeningSession = asyncHandler(async (req, res) => {
  const { sessionId, moodAfter } = req.body;

  res.json(
    await completeSession({
      userId: req.user._id,
      sessionId,
      moodAfter,
      socketManager: req.socketManager,
    })
  );
});

/** Public: support contacts must be reachable without an account. */
export const getSupportResources = asyncHandler(async (req, res) => {
  res.json({
    resources: getCrisisResources(resolveRegion(req)),
    notice: EMERGENCY_NOTICE,
  });
});
