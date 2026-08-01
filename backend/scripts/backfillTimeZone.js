/**
 * Gives existing users an explicit timezone.
 *
 * The field is new, so every account predating it has none and falls back to
 * UTC — which is what the whole system did implicitly before. Writing UTC
 * explicitly changes nothing about their behaviour; it makes the value visible
 * so a user can correct it, and it distinguishes "we never asked" from "they
 * are actually in UTC".
 *
 * Anyone whose timezone matters can set it in Settings, and new registrations
 * capture it from the browser.
 *
 * Note: for a user who is *not* in UTC, correcting their timezone moves their
 * day boundary once. A streak can gain or lose a day in that single
 * transition. That is unavoidable and is the correct end state.
 *
 *   node scripts/backfillTimeZone.js                    # dry run
 *   node scripts/backfillTimeZone.js --commit           # apply
 *   node scripts/backfillTimeZone.js --commit --tz=Asia/Kolkata
 */
import mongoose from "mongoose";
import connectDB from "../config/database.js";
import User from "../models/user.js";

const commit = process.argv.includes("--commit");
const requested = process.argv.find((arg) => arg.startsWith("--tz="))?.slice(5);

const isValidZone = (zone) => {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

const run = async () => {
  const zone = requested ?? "UTC";

  if (!isValidZone(zone)) {
    console.error(`"${zone}" is not a timezone this platform recognises.`);
    process.exit(1);
  }

  await connectDB();

  const missing = await User.countDocuments({
    $or: [{ timeZone: null }, { timeZone: { $exists: false } }],
  });

  console.log(`${missing} user(s) without an explicit timezone → "${zone}"`);

  if (commit && missing > 0) {
    const { modifiedCount } = await User.updateMany(
      { $or: [{ timeZone: null }, { timeZone: { $exists: false } }] },
      { $set: { timeZone: zone } }
    );
    console.log(`Set timezone on ${modifiedCount} user(s)`);
  } else if (!commit) {
    console.log("Dry run. Re-run with --commit");
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error("Timezone backfill failed:", error);
  process.exit(1);
});
