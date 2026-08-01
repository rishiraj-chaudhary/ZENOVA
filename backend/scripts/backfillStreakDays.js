/**
 * Gives existing users a `lastActivityDay` derived from their old
 * `lastActivity` timestamp.
 *
 * Streaks used to be computed from raw millisecond arithmetic on a Date; they
 * are now calendar-day keys, which is the only way a 23:00 → 08:00 visit counts
 * as two days. Anyone who predates that change has `lastActivityDay: null`, and
 * `nextStreakState` reads null as "never active" — so the first login after
 * deploy would silently reset a 40-day streak to 1.
 *
 * Idempotent: only touches documents where the key is missing.
 *
 *   node scripts/backfillStreakDays.js          # dry run
 *   node scripts/backfillStreakDays.js --commit # apply
 */
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import Gamification from "../models/Gamification.js";
import { dayKey } from "../utils/dayKey.js";

const commit = process.argv.includes("--commit");

const run = async () => {
  await connectDB();

  const stale = await Gamification.find({
    $or: [{ lastActivityDay: null }, { lastActivityDay: { $exists: false } }],
    currentStreak: { $gt: 0 },
  })
    .select("userId currentStreak lastActivity")
    .lean();

  console.log(`Found ${stale.length} streak(s) without a calendar day key`);

  let updated = 0;

  for (const stats of stale) {
    // lastActivity defaults to the document's creation time, so it is always
    // present; falling back to today only guards against hand-edited data.
    const key = dayKey(stats.lastActivity ?? new Date());

    if (commit) {
      await Gamification.updateOne(
        { _id: stats._id },
        { $set: { lastActivityDay: key } }
      );
    }

    console.log(
      `  ${stats.userId}: streak ${stats.currentStreak} anchored to ${key}`
    );
    updated += 1;
  }

  console.log(
    commit
      ? `Backfilled ${updated} streak(s)`
      : `Dry run: would backfill ${updated} streak(s). Re-run with --commit`
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
