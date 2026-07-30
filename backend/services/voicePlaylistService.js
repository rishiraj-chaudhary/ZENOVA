import Playlist from "../models/Playlist.js";
import AppError from "../utils/AppError.js";
import parseVoicePlaylistCommand from "../utils/parseVoicePlaylistCommand.js";
import { generateRecommendations } from "./recommendationService.js";

/**
 * Builds a playlist from a spoken command.
 *
 * Recommendations come from an in-process service call. The previous version
 * issued an HTTP request from the server back to its own hardcoded
 * http://localhost:3000 endpoint, which broke outside local development and
 * added a full network round-trip to every voice command.
 */
export const createPlaylistFromVoiceCommand = async ({
  userId,
  command,
  conversationHistory = [],
}) => {
  const { name, type } = parseVoicePlaylistCommand(command);

  const { recommendations, detectedMood } = await generateRecommendations({
    userId,
    message: command,
    conversationHistory,
  });

  if (recommendations.length === 0) {
    throw AppError.badGateway("No song recommendations available right now");
  }

  return Playlist.create({
    userId,
    name,
    type,
    createdBy: "voice",
    moodContext: detectedMood,
    songs: recommendations.map((song) => ({
      musicId: song.musicId,
      title: song.title,
      artist: song.artist,
      audioUrl: song.audioUrl,
      spotifyUri: song.spotifyUri,
      albumArt: song.albumArt,
      genre: song.genre,
      reason: song.reason ?? "Voice recommendation",
    })),
  });
};
