/**
 * Finds a 30-second preview for every song that has none.
 *
 * Spotify stopped returning `preview_url` for most tracks, so all 946 songs in
 * this catalogue had a null preview and the player's `<audio>` control rendered
 * nothing at all. iTunes Search still publishes previews and needs no key.
 *
 * Paced deliberately: iTunes rate-limits at roughly 20 requests a minute from
 * one address, and being throttled halfway through is worse than taking longer.
 *
 *   node scripts/backfillPreviews.js                # dry run, first 25
 *   node scripts/backfillPreviews.js --commit       # apply, first 25
 *   node scripts/backfillPreviews.js --commit --all # apply to everything
 */
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import MusicResource from "../models/MusicResource.js";
import Playlist from "../models/Playlist.js";
import { findPreviewUrl } from "../services/previewService.js";

const commit = process.argv.includes("--commit");
const all = process.argv.includes("--all");

const DEFAULT_LIMIT = 25;
const PACE_MS = 3200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Copies resolved previews into the embedded copies playlists hold. */
const syncPlaylistPreviews = async () => {
  const withPreviews = await MusicResource.find({
    previewUrl: { $nin: [null, ""] },
  })
    .select("previewUrl")
    .lean();

  const byId = new Map(withPreviews.map((song) => [song._id.toString(), song.previewUrl]));
  const playlists = await Playlist.find({ "songs.0": { $exists: true } });

  let updated = 0;

  for (const playlist of playlists) {
    let changed = false;

    for (const song of playlist.songs) {
      const preview = byId.get(song.musicId?.toString());
      if (preview && song.previewUrl !== preview) {
        song.previewUrl = preview;
        changed = true;
        updated += 1;
      }
    }

    if (changed && commit) await playlist.save();
  }

  return updated;
};

const run = async () => {
  await connectDB();

  const query = MusicResource.find({
    $or: [{ previewUrl: null }, { previewUrl: "" }, { previewUrl: { $exists: false } }],
  })
    .select("title artist")
    .sort({ lastRecommendedAt: -1 });

  if (!all) query.limit(DEFAULT_LIMIT);

  const songs = await query.lean();
  const total = await MusicResource.countDocuments({});

  console.log(
    `${songs.length} song(s) to look up (${total} in the catalogue)` +
      (all ? "" : ` — pass --all for the rest`)
  );

  let found = 0;
  let missing = 0;

  for (const [index, song] of songs.entries()) {
    const previewUrl = await findPreviewUrl(song.title, song.artist);

    if (previewUrl) {
      found += 1;
      if (commit) {
        await MusicResource.updateOne({ _id: song._id }, { $set: { previewUrl } });
      }
      console.log(`  ✓ ${song.title} — ${song.artist}`);
    } else {
      missing += 1;
      console.log(`  · ${song.title} — ${song.artist} (no preview)`);
    }

    // No need to wait after the last one.
    if (index < songs.length - 1) await sleep(PACE_MS);
  }

  console.log(
    commit
      ? `Backfilled ${found} preview(s); ${missing} had none available`
      : `Dry run: would backfill ${found}, ${missing} unavailable. Re-run with --commit`
  );

  // Playlist songs are embedded copies, so a preview found above does not reach
  // the playlists that already contain the song.
  const synced = await syncPlaylistPreviews();
  console.log(
    commit
      ? `Copied previews into ${synced} playlist entr(ies)`
      : `Would copy previews into ${synced} playlist entr(ies)`
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Preview backfill failed:", error);
  process.exit(1);
});
