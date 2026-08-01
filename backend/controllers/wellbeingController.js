import { getCrisisResources, EMERGENCY_NOTICE } from "../config/crisisResources.js";
import {
  buildMoodInsights,
  generateInsightNarrative,
} from "../services/moodInsightsService.js";
import { getMoodHistoryPage, recordMood } from "../services/moodService.js";
import {
  completeSession,
  markSessionListened,
  startSession,
} from "../services/outcomeService.js";
import {
  getFeedbackSignals,
  recordFeedback,
  removeFeedback,
} from "../services/tasteService.js";
import { checkAndAwardBadges } from "../services/badgeService.js";
import { awardPoints } from "../services/pointsService.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";
import AppError from "../utils/AppError.js";
import MusicResource from "../models/MusicResource.js";
import {
  MIN_OBSERVATIONS,
  PROVISIONAL_OBSERVATIONS,
  getLedgerCoverage,
  provenSongsFor,
} from "../services/songEffectService.js";

export const logMood = asyncHandler(async (req, res) => {
  const { mood, intensity, context } = req.body;

  const entry = await recordMood({
    userId: req.user._id,
    mood,
    intensity,
    context,
    source: "check-in",
  });

  // recordMood returns null when consent is absent. Reporting 201 with a null
  // body told the client the check-in had been saved when nothing was written,
  // so the UI showed a success state for a silent no-op.
  if (!entry) {
    throw AppError.forbidden(
      "Mood tracking consent is required to save a check-in"
    );
  }

  // Once per calendar day via the default entity key. Check-ins are what fill
  // the mood history the insights are drawn from.
  await awardPoints(req.user._id, "DAILY_CHECK_IN", req.socketManager);
  await checkAndAwardBadges(req.user._id, req.socketManager);

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

  const insights = await buildMoodInsights(req.user._id, {
    periodDays,
    timeZone: req.user.timeZone,
  });
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

/**
 * What has actually been measured to help this person.
 *
 * The one screen the product's central claim justifies, and until now the
 * ledger behind it was read only by the ranker. Everything here carries its
 * sample size and its evidence level, so a thin result reads as thin rather
 * than as a finding.
 */
export const getProvenSongs = asyncHandler(async (req, res) => {
  const startingMood = req.query.startingMood
    ? Number.parseInt(req.query.startingMood, 10)
    : undefined;

  const [proven, coverage] = await Promise.all([
    provenSongsFor(req.user._id, { startingMood }),
    getLedgerCoverage(),
  ]);

  const musicIds = [...proven.personal, ...proven.population].map((entry) => entry.musicId);
  const songs = await MusicResource.find({ _id: { $in: musicIds } })
    .select("title artist albumArt spotifyUri previewUrl genre")
    .lean();

  const byId = new Map(songs.map((song) => [song._id.toString(), song]));
  const decorate = (entry) => ({
    ...entry,
    song: byId.get(entry.musicId.toString()) ?? null,
  });

  res.json({
    personal: proven.personal.map(decorate).filter((entry) => entry.song),
    population: proven.population.map(decorate).filter((entry) => entry.song),
    measuredStates: proven.moods,
    coverage,
    thresholds: { provisional: PROVISIONAL_OBSERVATIONS, established: MIN_OBSERVATIONS },
  });
});

export const getSongFeedback = asyncHandler(async (req, res) => {
  res.json({ signals: await getFeedbackSignals(req.user._id) });
});

export const clearSongFeedback = asyncHandler(async (req, res) => {
  const removed = await removeFeedback({
    userId: req.user._id,
    musicId: req.params.musicId,
  });

  // "Feedback removed" was reported whether or not anything matched, so a
  // client whose delete silently missed still showed the rating as cleared.
  res.json({
    removed,
    message: removed ? "Feedback removed" : "No feedback to remove",
  });
});

export const beginListeningSession = asyncHandler(async (req, res) => {
  const { sessionId, moodBefore } = req.body;

  res.status(201).json(
    await startSession({
      userId: req.user._id,
      sessionId,
      moodBefore,
      timeZone: req.user.timeZone,
    })
  );
});

export const recordSessionListened = asyncHandler(async (req, res) => {
  const outcome = await markSessionListened({
    userId: req.user._id,
    sessionId: req.body.sessionId,
    socketManager: req.socketManager,
  });

  res.json({ recorded: Boolean(outcome) });
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
