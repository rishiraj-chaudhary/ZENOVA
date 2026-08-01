import FALLBACK_SONGS from "../constants/fallbackSongs.js";
import MusicResource from "../models/MusicResource.js";
import Recommendation from "../models/Recommendation.js";
import { buildMoodAnalysisPrompt } from "../prompts/moodPrompt.js";
import { buildRecommendationPrompt } from "../prompts/recommendationPrompt.js";
import parseRequestedSongCount from "../utils/parseRequestedSongCount.js";
import { generateJson, generateText } from "./geminiService.js";
import { RECOMMENDATION_SCHEMA } from "./schemas.js";
import { getLatestSelfRating, recordMood } from "./moodService.js";
import { hasMoodConsent } from "./consentService.js";
import {
  ELEVATED_RISK_PROMPT_GUIDANCE,
  RISK_LEVELS,
  assessRisk,
  buildCrisisResponse,
} from "./safetyService.js";
import { findTrack } from "./spotifyService.js";
import { rankByMeasuredEffect } from "./songEffectService.js";
import { buildTasteProfile, getSkippedSongTitles } from "./tasteService.js";
import { loadTherapyProfile } from "./userProfileService.js";
import logger from "../utils/logger.js";

const buildYouTubeSearchUrl = (title, artist) => {
  const cleaned = `${title} ${artist}`.replace(/[^\w\s]/g, " ").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${cleaned} official audio`
  )}`;
};

/**
 * Assembles the full personalization context.
 *
 * The taste profile and skip list are the parts that were previously missing:
 * the prompt read `likes`/`skips` from a field nothing ever wrote, so every
 * request looked identical regardless of how much the user had told us.
 */
const loadPersonalizationContext = async (userId, startingMood) => {
  const [profile, taste, avoidSongs, provenSongs] = await Promise.all([
    loadTherapyProfile(userId),
    buildTasteProfile(userId),
    getSkippedSongTitles(userId),
    loadProvenSongs(startingMood),
  ]);

  return { ...profile, taste, avoidSongs, provenSongs };
};

/**
 * Songs with a measured positive effect for people who started in this state.
 *
 * Empty until the ledger has evidence, which is the intended behaviour: the
 * product should recommend from measurement where it has it and fall back to
 * the model where it does not, rather than claiming an effect it cannot show.
 */
const loadProvenSongs = async (startingMood) => {
  if (!startingMood) return [];

  try {
    const ranked = await rankByMeasuredEffect(startingMood, { limit: 8 });
    if (ranked.length === 0) return [];

    const songs = await MusicResource.find({
      _id: { $in: ranked.map((entry) => entry.musicId) },
    })
      .select("title artist")
      .lean();

    const byId = new Map(songs.map((song) => [song._id.toString(), song]));

    return ranked
      .map((entry) => ({ ...entry, ...byId.get(entry.musicId.toString()) }))
      .filter((entry) => entry.title);
  } catch (error) {
    logger.warn("could not load measured effects", { detail: error.message });
    return [];
  }
};

/**
 * Mood detection is advisory — it sharpens the recommendation prompt but a
 * failure must not fail the whole request.
 */
const detectMood = async (message, conversationHistory, userProfile) => {
  try {
    return await generateText(
      buildMoodAnalysisPrompt(message, conversationHistory, userProfile),
      { operation: "mood" }
    );
  } catch (error) {
    logger.warn("Mood detection failed:", error.message);
    return null;
  }
};

const isUsableSong = (song) => Boolean(song?.title && song?.artist);

/**
 * Tops the list up from the curated catalogue when the model returns fewer
 * songs than asked for, skipping titles it already suggested.
 */
const padToRequestedCount = (songs, requestedCount) => {
  const usable = songs.filter(isUsableSong).slice(0, requestedCount);
  if (usable.length >= requestedCount) return usable;

  const alreadySuggested = new Set(
    usable.map((song) => song.title.toLowerCase())
  );
  const filler = FALLBACK_SONGS.filter(
    (song) => !alreadySuggested.has(song.title.toLowerCase())
  );

  return [...usable, ...filler].slice(0, requestedCount);
};

const buildFallbackResult = (requestedCount, currentMood) => ({
  response: `I understand you're looking for music recommendations. Here are ${requestedCount} carefully selected therapeutic songs that might help.`,
  detectedMood: currentMood ?? "neutral",
  therapeuticGoal: "emotional support through music",
  recommendations: FALLBACK_SONGS.slice(0, requestedCount),
});

/**
 * Persists a song and returns the client-facing recommendation entry.
 * Spotify lookup is best-effort; an unmatched song degrades to a YouTube search.
 */
const resolveAndPersistSong = async (song) => {
  const spotifyTrack = await findTrack(song.title, song.artist);
  const audioUrl = spotifyTrack?.spotifyUrl ?? buildYouTubeSearchUrl(song.title, song.artist);

  const musicResource = await MusicResource.findOneAndUpdate(
    { title: song.title, artist: song.artist },
    {
      title: song.title,
      artist: song.artist,
      genre: song.genre ?? "Various",
      moodTags: song.moodTags ?? [],
      audioUrl,
      duration: song.duration ?? 0,
      recommendedFor: song.recommendedFor ?? [],
      energyLevel: song.energyLevel ?? "medium",
      therapeuticFunction: song.therapeuticFunction ?? "support",
      lastRecommendedAt: new Date(),
      ...(spotifyTrack && {
        spotifyId: spotifyTrack.spotifyId,
        spotifyUri: spotifyTrack.spotifyUri,
        spotifyUrl: spotifyTrack.spotifyUrl,
        previewUrl: spotifyTrack.previewUrl,
        albumArt: spotifyTrack.albumArt,
        popularity: spotifyTrack.popularity,
        explicit: spotifyTrack.explicit,
      }),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return {
    musicId: musicResource._id,
    title: song.title,
    artist: song.artist,
    audioUrl,
    genre: song.genre ?? "Various",
    reason: song.reason,
    energyLevel: song.energyLevel ?? "medium",
    therapeuticFunction: song.therapeuticFunction ?? "support",
    ...(spotifyTrack && {
      spotifyId: spotifyTrack.spotifyId,
      spotifyUri: spotifyTrack.spotifyUri,
      spotifyUrl: spotifyTrack.spotifyUrl,
      previewUrl: spotifyTrack.previewUrl,
      albumArt: spotifyTrack.albumArt,
    }),
  };
};

/**
 * Produces song recommendations for a user message.
 *
 * Risk is assessed before anything else. A message indicating self-harm never
 * reaches the recommendation path — the caller receives support contacts
 * instead of a playlist.
 *
 * The Spotify lookups and upserts run concurrently: they are independent per
 * song, and doing them serially made an 8-song response take 8 sequential
 * round-trips to Spotify plus 8 sequential writes.
 */
export const generateRecommendations = async ({
  userId,
  message,
  conversationHistory = [],
  region,
}) => {
  const risk = await assessRisk(message, { region });
  if (risk.level === RISK_LEVELS.CRISIS) {
    return buildCrisisResponse(risk);
  }

  const startingMood = await getLatestSelfRating(userId);
  const userProfile = await loadPersonalizationContext(userId, startingMood);
  const requestedCount = parseRequestedSongCount(message);

  const currentMood = await detectMood(message, conversationHistory, userProfile);

  const basePrompt = buildRecommendationPrompt({
    userInput: message,
    requestedCount,
    conversationHistory,
    userProfile,
    currentMood,
  });

  // generateJson returns null on an unparseable response but throws on an
  // outage. Both must degrade to the curated set: at elevated risk the support
  // contacts travel with this response, and an exception would discard them
  // and surface an error bubble instead.
  let aiResult = null;
  try {
    aiResult = await generateJson(
      risk.level === RISK_LEVELS.ELEVATED
        ? `${ELEVATED_RISK_PROMPT_GUIDANCE}\n\n${basePrompt}`
        : basePrompt,
      { schema: RECOMMENDATION_SCHEMA, operation: "recommendation" }
    );
  } catch (error) {
    logger.warn("recommendation generation failed, using curated set", {
      detail: error.message,
      risk: risk.level,
    });
  }

  const usedFallback = !Array.isArray(aiResult?.recommendations);
  const result = usedFallback
    ? buildFallbackResult(requestedCount, currentMood)
    : aiResult;

  const songs = padToRequestedCount(result.recommendations, requestedCount);

  const settled = await Promise.allSettled(songs.map(resolveAndPersistSong));
  const recommendations = settled
    .filter((outcome) => outcome.status === "fulfilled")
    .map((outcome) => outcome.value);

  settled
    .filter((outcome) => outcome.status === "rejected")
    .forEach((outcome) => logger.error("Failed to persist song:", outcome.reason));

  const detectedMood = result.detectedMood ?? currentMood;

  // A mood the model inferred from the message is still health data. Without
  // consent the recommendation is still recorded — it is a log of what the
  // service returned — but the inferred emotional state is not attached to it.
  const mayStoreMood = await hasMoodConsent(userId);

  const recommendation = await Recommendation.create({
    userId,
    detectedMood: mayStoreMood ? detectedMood : undefined,
    therapeuticGoal: result.therapeuticGoal,
    recommendedMusic: recommendations.map((entry) => ({
      musicId: entry.musicId,
      reason: entry.reason,
      energyLevel: entry.energyLevel,
      therapeuticFunction: entry.therapeuticFunction,
    })),
  });

  if (detectedMood) {
    await recordMood({ userId, mood: detectedMood, context: message, source: "chat" });
  }

  return {
    // Returned so the client can attach before/after feedback to this session.
    sessionId: recommendation._id,
    response: result.response,
    detectedMood,
    therapeuticGoal: result.therapeuticGoal,
    recommendations,
    // Lets the client say these are stand-ins rather than passing off the same
    // curated eight songs as a personalised result.
    curated: usedFallback,
    // Present only at elevated risk: support is offered alongside the music.
    ...(risk.level === RISK_LEVELS.ELEVATED && {
      riskLevel: risk.level,
      supportResources: risk.resources,
      emergencyNotice: risk.notice,
    }),
  };
};
