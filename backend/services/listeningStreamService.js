import ListeningEvent from "../models/ListeningEvent.js";
import { contextOf } from "./baselineService.js";
import { derivePersona } from "./personaService.js";
import { fetchArtistGenres, fetchRecentlyPlayed } from "./spotifyService.js";
import { acquireLock } from "../utils/taskLock.js";
import logger from "../utils/logger.js";

/**
 * Accumulating what somebody listens to when nobody is recommending.
 *
 * Spotify's recently-played goes 50 items deep and no further, so a single call
 * is a snapshot. Polled and stored, it becomes a longitudinal record — and
 * because nothing in this app influenced those plays, it is observational data
 * about what a person reaches for unprompted. That is the natural-experiment
 * substrate the causal work needs, and it is not something a recommender can
 * manufacture for itself.
 */

/** Spotify rate-limits per app, so polling has to be paced. */
const POLL_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Pulls new plays for one user.
 *
 * The unique index on (user, track, playedAt) makes overlap free: every poll
 * re-reads plays it has already seen, and they simply conflict.
 */
export const syncListeningHistory = async (user, accessToken) => {
  if (!accessToken) return { synced: 0 };

  const newest = await ListeningEvent.findOne({ userId: user._id })
    .sort({ playedAt: -1 })
    .select("playedAt")
    .lean();

  let plays;
  try {
    plays = await fetchRecentlyPlayed(accessToken, {
      after: newest ? new Date(newest.playedAt).getTime() : undefined,
    });
  } catch (error) {
    if (error.retryAfter) {
      logger.warn("Spotify rate limited the listening poll", { retryAfter: error.retryAfter });
      return { synced: 0, rateLimited: true };
    }
    throw error;
  }

  if (plays.length === 0) return { synced: 0 };

  // One batched genre lookup for the whole page rather than one per track.
  const genresByArtist = await fetchArtistGenres(
    plays.flatMap((play) => play.artistIds),
    accessToken
  );

  const timeZone = user.timeZone ?? "UTC";

  const documents = plays.map((play) => ({
    ...play,
    userId: user._id,
    genres: [...new Set(play.artistIds.flatMap((id) => genresByArtist[id] ?? []))],
    hourOfDay: contextOf(play.playedAt, timeZone).hourOfDay,
  }));

  try {
    await ListeningEvent.insertMany(documents, { ordered: false });
  } catch (error) {
    // Duplicates are the expected case on every poll after the first.
    if (error.code !== 11000) throw error;
  }

  return { synced: documents.length };
};

/**
 * The scheduled pass over everyone with a connected account.
 *
 * Locked with the same Mongo-backed primitive the leaderboard rebuild uses, so
 * several instances cannot poll the same person at once. No queue, no scheduler
 * dependency — the mechanism is already in this codebase and already proven.
 */
export const pollListeningHistories = async ({ limit = 25, getAccessToken } = {}) => {
  const acquired = await acquireLock("spotify:listening-poll", POLL_INTERVAL_MS);
  if (!acquired) return { skipped: true };

  const { default: User } = await import("../models/user.js");

  const users = await User.find({ spotifyId: { $ne: null } })
    .select("spotifyId timeZone")
    .limit(limit)
    .lean();

  let synced = 0;
  let personas = 0;

  for (const user of users) {
    try {
      const accessToken = await getAccessToken?.(user);
      if (!accessToken) continue;

      const result = await syncListeningHistory(user, accessToken);
      synced += result.synced;

      // Refreshing the persona here rather than on a separate schedule keeps
      // the exploration temperature in step with the history it is derived
      // from.
      if (result.synced > 0) {
        await derivePersona(user._id);
        personas += 1;
      }
    } catch (error) {
      logger.warn("listening sync failed for a user", { detail: error.message });
    }
  }

  logger.info("listening histories polled", { users: users.length, synced, personas });
  return { users: users.length, synced, personas };
};

export default { syncListeningHistory, pollListeningHistories };
