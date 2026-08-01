import ListeningFeedback from "../models/ListeningFeedback.js";
import MusicResource from "../models/MusicResource.js";
import AppError from "../utils/AppError.js";
import { toObjectId } from "../utils/toObjectId.js";

const TOP_GENRE_LIMIT = 6;

/**
 * Records what a user thought of a recommended song.
 *
 * Upserted on {userId, musicId} so changing your mind replaces the old signal
 * rather than accumulating contradictory ones.
 */
export const recordFeedback = async ({
  userId,
  musicId,
  signal,
  sessionId,
  moodAtTime,
}) => {
  const song = await MusicResource.findById(musicId).select("genre").lean();
  if (!song) throw AppError.notFound("Song not found");

  return ListeningFeedback.findOneAndUpdate(
    { userId, musicId },
    { userId, musicId, signal, sessionId, moodAtTime, genre: song.genre },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * The user's standing opinions, keyed by song.
 *
 * Nothing exposed these, so the buttons had no way to show what you had already
 * rated: every reload came back blank and a rating looked like it had not
 * saved. Returned as a map so the client can look a song up without scanning.
 */
export const getFeedbackSignals = async (userId) => {
  const rows = await ListeningFeedback.find({ userId }).select("musicId signal").lean();

  return Object.fromEntries(rows.map((row) => [row.musicId.toString(), row.signal]));
};

/** Reports whether anything was actually removed, so the caller can be honest. */
export const removeFeedback = async ({ userId, musicId }) => {
  const { deletedCount } = await ListeningFeedback.deleteOne({ userId, musicId });
  return deletedCount > 0;
};

const topGenres = (rows) =>
  rows
    .filter((row) => row._id)
    .slice(0, TOP_GENRE_LIMIT)
    .map((row) => row._id);

/**
 * Aggregates a user's feedback into the shape the recommendation prompt reads.
 *
 * One grouped aggregation rather than two collection scans, so this stays cheap
 * enough to run on every recommendation request.
 */
export const buildTasteProfile = async (userId) => {
  const grouped = await ListeningFeedback.aggregate([
    // Cast explicitly — see utils/toObjectId.js. A string here returned an
    // empty profile, so a user's ratings never reached the prompt.
    { $match: { userId: toObjectId(userId) } },
    { $group: { _id: { signal: "$signal", genre: "$genre" }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const bySignal = (signal) =>
    grouped
      .filter((row) => row._id.signal === signal)
      .map((row) => ({ _id: row._id.genre, count: row.count }));

  const likedRows = bySignal("liked");
  const savedRows = bySignal("saved");
  const skippedRows = bySignal("skipped");

  const likedGenres = topGenres(likedRows);
  const skippedGenres = topGenres(skippedRows).filter(
    // A genre the user also likes is not a genre to avoid.
    (genre) => !likedGenres.includes(genre)
  );

  return {
    likedGenres,
    skippedGenres,
    savedGenres: topGenres(savedRows),
    totalSignals: grouped.reduce((sum, row) => sum + row.count, 0),
  };
};

/** Songs the user skipped, so recommendations stop resurfacing them. */
export const getSkippedSongTitles = async (userId, limit = 30) => {
  const skipped = await ListeningFeedback.find({ userId, signal: "skipped" })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate("musicId", "title artist")
    .lean();

  return skipped
    .filter((entry) => entry.musicId)
    .map((entry) => `${entry.musicId.title} — ${entry.musicId.artist}`);
};

export const deleteAllFeedback = (userId) => ListeningFeedback.deleteMany({ userId });
