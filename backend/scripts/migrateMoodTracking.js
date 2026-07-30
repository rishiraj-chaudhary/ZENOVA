/**
 * Moves the legacy embedded `user.moodTracking` array into the MoodEntry
 * collection, then clears it.
 *
 * Idempotent: entries already migrated are skipped by matching on
 * {userId, recordedAt}. Safe to re-run.
 *
 *   node scripts/migrateMoodTracking.js          # dry run
 *   node scripts/migrateMoodTracking.js --commit # apply
 */
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import MoodEntry from "../models/MoodEntry.js";
import User from "../models/user.js";

const commit = process.argv.includes("--commit");

const run = async () => {
  await connectDB();

  // moodTracking is no longer in the schema, so read it as a raw document.
  const users = await mongoose.connection
    .collection("users")
    .find({ moodTracking: { $exists: true, $ne: [] } })
    .project({ _id: 1, moodTracking: 1 })
    .toArray();

  console.log(`Found ${users.length} user(s) with legacy mood history`);

  let migrated = 0;
  let skipped = 0;

  for (const user of users) {
    for (const legacy of user.moodTracking) {
      if (!legacy?.mood) {
        skipped += 1;
        continue;
      }

      const recordedAt = legacy.date ?? legacy.recordedAt ?? new Date();
      const exists = await MoodEntry.exists({ userId: user._id, recordedAt });

      if (exists) {
        skipped += 1;
        continue;
      }

      if (commit) {
        await MoodEntry.create({
          userId: user._id,
          mood: legacy.mood,
          context: legacy.context,
          source: "chat",
          recordedAt,
        });
      }
      migrated += 1;
    }

    if (commit) {
      await mongoose.connection
        .collection("users")
        .updateOne({ _id: user._id }, { $unset: { moodTracking: "" } });
    }
  }

  console.log(
    commit
      ? `Migrated ${migrated} entries, skipped ${skipped}, cleared legacy arrays`
      : `Dry run: would migrate ${migrated} entries, skip ${skipped}. Re-run with --commit`
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
