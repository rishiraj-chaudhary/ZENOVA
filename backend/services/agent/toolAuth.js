import Playlist from "../../models/Playlist.js";
import { MUTATING } from "./toolRegistry.js";

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
    if (scope === "spotify" && !ctx.spotify?.connected) {
      return denied("A connected Spotify account is required for this");
    }
  }

  // A run that has read third-party text cannot be trusted to be acting on its
  // operator's instructions any more, so it loses everything that changes state.
  if (ctx.tainted && MUTATING.has(tool.sideEffect)) {
    return denied(
      "This conversation has read content written by someone else, so changes are disabled"
    );
  }

  if (MUTATING.has(tool.sideEffect) && tool.requiresConfirmation && !ctx.confirmed) {
    return denied("This needs the user to confirm it first");
  }

  if (tool.ownership === "playlist-member") {
    const playlistId = input.playlistId;
    if (!playlistId) return denied("This needs a playlist");

    const member = await Playlist.exists({
      _id: playlistId,
      $or: [{ userId: ctx.userId }, { collaborators: ctx.userId }],
    });

    if (!member) return denied("That playlist is not yours");
  }

  return allowed;
};

export default checkToolCall;
