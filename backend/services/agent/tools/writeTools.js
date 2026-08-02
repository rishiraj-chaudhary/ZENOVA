import Playlist from "../../../models/Playlist.js";
import { recordMood } from "../../moodService.js";
import { addSongToPlaylist, createPlaylist } from "../../playlistService.js";
import { completeSession, startSession } from "../../outcomeService.js";
import { recordFeedback } from "../../tasteService.js";
import { registerTool } from "../toolRegistry.js";

/**
 * Tools that change something.
 *
 * Every one requires confirmation, is refused on a tainted run, and writes a
 * ToolAudit row. The rule that matters: the handler never receives a userId —
 * it takes the one on the context, which came from the verified session — so a
 * model cannot act on anyone but the person it is talking to, however it is
 * asked.
 */
export const registerWriteTools = () => {
  registerTool({
    name: "log_checkin",
    description:
      "Record how the user feels right now, on a 1-5 scale where 1 is awful " +
      "and 5 is great. Only call this when they have actually told you.",
    inputSchema: {
      type: "object",
      properties: {
        mood: {
          type: "string",
          enum: ["awful", "low", "okay", "good", "great"],
        },
        intensity: { type: "integer", minimum: 1, maximum: 5 },
        note: { type: "string", maxLength: 200 },
      },
      required: ["mood", "intensity"],
    },
    sideEffect: "write",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ mood, intensity, note }, ctx) => {
      const entry = await recordMood({
        userId: ctx.userId,
        mood,
        intensity,
        context: note,
        source: "check-in",
      });

      return { recorded: Boolean(entry), mood, intensity };
    },
  });

  registerTool({
    name: "start_session",
    description:
      "Open a measured listening session by recording how the user feels " +
      "before they listen. Needs the session id from a recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", maxLength: 40 },
        moodBefore: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["sessionId", "moodBefore"],
    },
    sideEffect: "write",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ sessionId, moodBefore }, ctx) => {
      const outcome = await startSession({
        userId: ctx.userId,
        sessionId,
        moodBefore,
        timeZone: ctx.timeZone,
      });

      return { started: true, moodBefore: outcome.moodBefore };
    },
  });

  registerTool({
    name: "complete_session",
    description:
      "Close a listening session by recording how the user feels afterwards. " +
      "This is the measurement the whole system is built on.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: { type: "string", maxLength: 40 },
        moodAfter: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["sessionId", "moodAfter"],
    },
    sideEffect: "write",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ sessionId, moodAfter }, ctx) => {
      const outcome = await completeSession({
        userId: ctx.userId,
        sessionId,
        moodAfter,
        socketManager: ctx.socketManager ?? null,
      });

      return {
        completed: true,
        change: outcome.moodAfter - outcome.moodBefore,
        lift: outcome.lift,
      };
    },
  });

  registerTool({
    name: "rate_song",
    description:
      "Record that the user liked or did not want a song. A skip stops it " +
      "being suggested again.",
    inputSchema: {
      type: "object",
      properties: {
        musicId: { type: "string", maxLength: 40 },
        signal: { type: "string", enum: ["liked", "skipped", "saved"] },
      },
      required: ["musicId", "signal"],
    },
    sideEffect: "write",
    ownership: "self",
    handler: async ({ musicId, signal }, ctx) => {
      await recordFeedback({ userId: ctx.userId, musicId, signal });
      return { recorded: true, signal };
    },
  });

  registerTool({
    name: "create_playlist",
    description: "Create a new empty playlist owned by the user.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string", maxLength: 100 } },
      required: ["name"],
    },
    sideEffect: "write",
    ownership: "self",
    handler: async ({ name }, ctx) => {
      const playlist = await createPlaylist({ userId: ctx.userId, name });
      return { playlistId: playlist._id, name: playlist.name };
    },
  });

  registerTool({
    name: "add_song_to_playlist",
    description: "Add one song to a playlist the user owns or collaborates on.",
    inputSchema: {
      type: "object",
      properties: {
        playlistId: { type: "string", maxLength: 40 },
        songId: { type: "string", maxLength: 40 },
      },
      required: ["playlistId", "songId"],
    },
    sideEffect: "write",
    ownership: "playlist-member",
    handler: async ({ playlistId, songId }, ctx) => {
      const { song } = await addSongToPlaylist({
        playlistId,
        songId,
        userId: ctx.userId,
      });

      return { added: true, title: song.title };
    },
  });

  registerTool({
    name: "delete_playlist",
    description:
      "Permanently delete a playlist the user owns. This cannot be undone, so " +
      "never call it unless they have asked for that specific playlist by name.",
    inputSchema: {
      type: "object",
      properties: { playlistId: { type: "string", maxLength: 40 } },
      required: ["playlistId"],
    },
    sideEffect: "destructive",
    // Checked in toolAuth before dispatch, not here. The handler still scopes
    // its own query as defence in depth, but the guarantee lives one layer up.
    ownership: "playlist-owner",
    handler: async ({ playlistId }, ctx) => {
      const deleted = await Playlist.findOneAndDelete({
        _id: playlistId,
        userId: ctx.userId,
      });

      if (!deleted) throw new Error("That playlist is not yours to delete");
      return { deleted: true, name: deleted.name };
    },
  });
};

export default registerWriteTools;
