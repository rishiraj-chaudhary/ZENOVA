import FALLBACK_SONGS from "../constants/fallbackSongs.js";
import MusicResource from "../models/MusicResource.js";
import Recommendation from "../models/Recommendation.js";
import { buildMoodAnalysisPrompt } from "../prompts/moodPrompt.js";
import { buildRecommendationPrompt } from "../prompts/recommendationPrompt.js";
import parseRequestedSongCount from "../utils/parseRequestedSongCount.js";
import { generateJson, generateText } from "./geminiService.js";
import { RECOMMENDATION_SCHEMA } from "./schemas.js";
import { recordMood } from "./moodService.js";
import {
  ELEVATED_RISK_PROMPT_GUIDANCE,
  RISK_LEVELS,
  assessRisk,
  buildCrisisResponse,
} from "./safetyService.js";
import { findTrack } from "./spotifyService.js";
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
const loadPersonalizationContext = async (userId) => {
  const [profile, taste, avoidSongs] = await Promise.all([
    loadTherapyProfile(userId),
    buildTasteProfile(userId),
    getSkippedSongTitles(userId),
  ]);

  return { ...profile, taste, avoidSongs };
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

  const userProfile = await loadPersonalizationContext(userId);
  const requestedCount = parseRequestedSongCount(message);

  const currentMood = await detectMood(message, conversationHistory, userProfile);

  const basePrompt = buildRecommendationPrompt({
    userInput: message,
    requestedCount,
    conversationHistory,
    userProfile,
    currentMood,
  });

  const aiResult = await generateJson(
    risk.level === RISK_LEVELS.ELEVATED
      ? `${ELEVATED_RISK_PROMPT_GUIDANCE}\n\n${basePrompt}`
      : basePrompt,
    { schema: RECOMMENDATION_SCHEMA, operation: "recommendation" }
  );

  const result = Array.isArray(aiResult?.recommendations)
    ? aiResult
    : buildFallbackResult(requestedCount, currentMood);

  const songs = padToRequestedCount(result.recommendations, requestedCount);

  const settled = await Promise.allSettled(songs.map(resolveAndPersistSong));
  const recommendations = settled
    .filter((outcome) => outcome.status === "fulfilled")
    .map((outcome) => outcome.value);

  settled
    .filter((outcome) => outcome.status === "rejected")
    .forEach((outcome) => logger.error("Failed to persist song:", outcome.reason));

  const detectedMood = result.detectedMood ?? currentMood;

  const recommendation = await Recommendation.create({
    userId,
    detectedMood,
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
    // Present only at elevated risk: support is offered alongside the music.
    ...(risk.level === RISK_LEVELS.ELEVATED && {
      riskLevel: risk.level,
      supportResources: risk.resources,
      emergencyNotice: risk.notice,
    }),
  };
};
