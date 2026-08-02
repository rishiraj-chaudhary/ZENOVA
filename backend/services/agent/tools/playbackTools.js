import MusicResource from "../../../models/MusicResource.js";
import { startSession } from "../../outcomeService.js";
import { getEffectForSong } from "../../songEffectService.js";
import {
  fetchDevices,
  fetchPlaybackState,
  startPlayback,
} from "../../spotifyService.js";
import { registerTool } from "../toolRegistry.js";

/**
 * Playing music, and measuring what it did.
 *
 * These are what close the loop. The ledger could say which songs had helped
 * and nothing could act on it; Spotify playback existed and nothing chose what
 * to play. "Play me something that's worked when I've felt like this" now runs
 * end to end: read the measured effects, resolve a track, start it on whatever
 * device they have, and open the measurement that feeds the ledger which
 * answered the question.
 *
 * The Spotify access token belongs to the browser's Spotify session, not to
 * ours, so it travels on the context and is never an argument — which also
 * keeps it out of the recorded tool inputs in AgentStep.
 */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const registerPlaybackTools = () => {
  registerTool({
    name: "search_catalog",
    description:
      "Find songs in ZENOVA's catalogue by title or artist. Returns each " +
      "song's id, which the playback tools need. Use this to turn a name the " +
      "user said into something you can actually play.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 120 },
        limit: { type: "integer", minimum: 1, maximum: 10, default: 5 },
      },
      required: ["query"],
    },
    sideEffect: "read",
    ownership: "public",
    handler: async ({ query, limit }) => {
      const pattern = new RegExp(escapeRegex(query), "i");

      const songs = await MusicResource.find({
        $or: [{ title: pattern }, { artist: pattern }],
      })
        .select("title artist genre spotifyUri previewUrl")
        .limit(limit)
        .lean();

      return {
        results: songs.map((song) => ({
          songId: song._id,
          title: song.title,
          artist: song.artist,
          genre: song.genre,
          playableOnSpotify: Boolean(song.spotifyUri),
          hasPreview: Boolean(song.previewUrl),
        })),
      };
    },
  });

  registerTool({
    name: "get_playback_devices",
    description:
      "Where this user can hear a full track right now — their browser if they " +
      "have Premium, or any other device with Spotify open, which works on a " +
      "free account. Check this before offering to play something.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    scopes: ["spotify"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const devices = await fetchDevices(ctx.spotify.accessToken);

      return {
        devices: devices.map((device) => ({
          deviceId: device.id,
          name: device.name,
          type: device.type,
          active: device.is_active,
        })),
        // Nowhere to play is a real answer, not an error: the preview ladder
        // still exists and the user should be told which rung they are on.
        canPlayFullTracks: devices.length > 0,
      };
    },
  });

  registerTool({
    name: "play_track",
    description:
      "Start playing one song on the user's Spotify. Needs a songId from " +
      "search_catalog or get_what_works_for_me. Say what you are about to play " +
      "and why before calling this.",
    inputSchema: {
      type: "object",
      properties: {
        songId: { type: "string", maxLength: 40 },
        deviceId: { type: "string", maxLength: 80 },
      },
      required: ["songId"],
    },
    // External rather than write: it changes something outside this system.
    // Confirmation is not bureaucracy here — audio starting unannounced is
    // jarring, and the dialogue names the track before anything plays.
    sideEffect: "external",
    scopes: ["spotify"],
    ownership: "self",
    timeoutMs: 8000,
    handler: async ({ songId, deviceId }, ctx) => {
      const song = await MusicResource.findById(songId)
        .select("title artist spotifyUri")
        .lean();

      if (!song) throw new Error("That song is not in the catalogue");
      if (!song.spotifyUri) {
        throw new Error(`"${song.title}" has no Spotify track — offer the preview instead`);
      }

      await startPlayback(ctx.spotify.accessToken, {
        deviceId,
        uris: [song.spotifyUri],
      });

      return { playing: true, title: song.title, artist: song.artist };
    },
  });

  registerTool({
    name: "play_what_works",
    description:
      "Play the song with the strongest measured effect for someone starting " +
      "at this mood, and open a measured session so the result feeds back. " +
      "This is the one to reach for when the user asks for something that has " +
      "helped them before.",
    inputSchema: {
      type: "object",
      properties: {
        startingMood: { type: "integer", minimum: 1, maximum: 5 },
        sessionId: { type: "string", maxLength: 40 },
        deviceId: { type: "string", maxLength: 80 },
      },
      required: ["startingMood"],
    },
    sideEffect: "external",
    scopes: ["spotify", "moodTracking"],
    ownership: "self",
    timeoutMs: 10000,
    handler: async ({ startingMood, sessionId, deviceId }, ctx) => {
      const { provenSongsFor } = await import("../../songEffectService.js");
      const proven = await provenSongsFor(ctx.userId, { startingMood, limit: 5 });

      const candidates = [...proven.personal, ...proven.population];
      if (candidates.length === 0) {
        throw new Error(
          "Nothing has been measured for this state yet — recommend something " +
            "and rate it afterwards, and next time there will be an answer"
        );
      }

      const songs = await MusicResource.find({
        _id: { $in: candidates.map((entry) => entry.musicId) },
        spotifyUri: { $nin: [null, ""] },
      })
        .select("title artist spotifyUri")
        .lean();

      if (songs.length === 0) {
        throw new Error("The songs measured to help are not playable on Spotify");
      }

      const byId = new Map(songs.map((song) => [song._id.toString(), song]));
      const chosen = candidates.find((entry) => byId.has(entry.musicId.toString()));
      const song = byId.get(chosen.musicId.toString());

      await startPlayback(ctx.spotify.accessToken, {
        deviceId,
        uris: [song.spotifyUri],
      });

      // Opening the session is the point. Playing without measuring would make
      // the next answer to this question no better than this one.
      let measuring = false;
      if (sessionId) {
        try {
          await startSession({
            userId: ctx.userId,
            sessionId,
            moodBefore: startingMood,
            timeZone: ctx.timeZone,
          });
          measuring = true;
        } catch {
          // A session that cannot be opened must not stop the music.
        }
      }

      return {
        playing: true,
        title: song.title,
        artist: song.artist,
        sessions: chosen.observations,
        evidence: chosen.evidence,
        averageChange: Number((chosen.meanDelta ?? 0).toFixed(2)),
        measuring,
      };
    },
  });

  registerTool({
    name: "get_now_playing",
    description: "What is playing on the user's Spotify right now, and how far in.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    scopes: ["spotify"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const state = await fetchPlaybackState(ctx.spotify.accessToken);
      if (!state?.trackId) return { playing: false };

      const song = await MusicResource.findOne({
        spotifyUri: `spotify:track:${state.trackId}`,
      })
        .select("title artist")
        .lean();

      const effect = song ? await getEffectForSong(song._id, 3) : null;

      return {
        playing: state.isPlaying,
        title: song?.title ?? null,
        artist: song?.artist ?? null,
        progressSeconds: Math.round(state.progressMs / 1000),
        // Only if it is a song we have measured; otherwise say nothing rather
        // than implying we know something about it.
        measuredEffect: effect
          ? { averageChange: Number(effect.meanDelta.toFixed(2)), sessions: effect.observations }
          : null,
      };
    },
  });
};

export default registerPlaybackTools;
