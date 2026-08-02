import Playlist from "../../models/Playlist.js";
import { BLOCKED_WHEN_TAINTED, MUTATING } from "./toolRegistry.js";

/**
 * Whether this call is allowed, decided before the handler runs.
 *
 * Checked here rather than inside handlers, because a check inside a handler is
 * a check someone will eventually forget to write. There are two rules and they
 * carry the whole security model:
 *
 *  1. `ctx.userId` comes from the verified session. No tool accepts a userId
 *     parameter — the registry rejects one outright. This is the same
 *     discipline as socketManager, where identity comes from socket.data and
 *     never from the event payload; one layer up.
 *  2. Ownership is a query, not a comparison. "Can this person act on this
 *     playlist" is answered by asking the database for a document matching both
 *     the id and the membership, so a caller who is not a member cannot even
 *     read it.
 *
 * The red-team suite caught the second rule being broken the first time it ran:
 * delete_playlist declared `ownership: "self"`, which meant no check happened
 * here at all and the guarantee rested entirely on the handler remembering to
 * scope its own query. That is exactly the "one will eventually be missed"
 * failure this layer exists to prevent, so destructive playlist tools now
 * declare `playlist-owner` and are checked here like everything else.
 */

const denied = (reason) => ({ allowed: false, reason });
const allowed = { allowed: true, reason: null };

export const checkToolCall = async ({ tool, input, ctx }) => {
  if (!ctx?.userId) return denied("No authenticated user on this run");

  // Consent gates are scopes. A tool that reads or writes mood data cannot run
  // for someone who has not agreed to mood tracking, whatever the model decides.
  for (const scope of tool.scopes ?? []) {
    if (scope === "moodTracking" && !ctx.consent?.moodTracking) {
      return denied("Mood tracking consent is required for this");
    }
    if (scope === "spotify" && !ctx.spotify?.accessToken) {
      return denied(
        "Connect Spotify first — I need an active session to control playback"
      );
    }
  }

  // A tainted run loses anything irreversible. Playback survives because it is
  // reversible and the confirmation names the exact track — see the reasoning
  // on BLOCKED_WHEN_TAINTED in toolRegistry.
  if (ctx.tainted && BLOCKED_WHEN_TAINTED.has(tool.sideEffect)) {
    return denied(
      "This conversation has read content written by someone else, so changes are disabled"
    );
  }

  if (MUTATING.has(tool.sideEffect) && tool.requiresConfirmation && !ctx.confirmed) {
    return denied("This needs the user to confirm it first");
  }

  if (tool.ownership === "playlist-member" || tool.ownership === "playlist-owner") {
    const playlistId = input.playlistId;
    if (!playlistId) return denied("This needs a playlist");

    // Owner-only for anything destructive: a collaborator may add songs and
    // must not be able to destroy somebody else's playlist. Expressed as a
    // query rather than a comparison, so a caller who does not qualify cannot
    // even read the document.
    const filter =
      tool.ownership === "playlist-owner"
        ? { _id: playlistId, userId: ctx.userId }
        : {
            _id: playlistId,
            $or: [{ userId: ctx.userId }, { collaborators: ctx.userId }],
          };

    if (!(await Playlist.exists(filter))) return denied("That playlist is not yours");
  }

  return allowed;
};

export default checkToolCall;
