import BaselineCell from "../models/BaselineCell.js";
import MoodEntry from "../models/MoodEntry.js";
import SessionOutcome from "../models/SessionOutcome.js";
import logger from "../utils/logger.js";

/**
 * How much a randomized observation outweighs an observational one.
 *
 * The control arm is assigned; nobody chose it, so it estimates the
 * counterfactual honestly. A check-in pair with no session between it is a
 * control group that selected itself — people who do not open a session may
 * differ systematically from those who do. Useful, and much more plentiful, but
 * not the same evidence.
 */
const OBSERVATIONAL_WEIGHT = 0.35;

/** Below this the cell is reported but never asserted. */
export const MIN_BASELINE_OBSERVATIONS = 15;

/** Shrinks a thin cell toward no-change, matching how SongEffect ranks. */
const PRIOR_STRENGTH = MIN_BASELINE_OBSERVATIONS;

/**
 * The context a session happened in, in the user's own timezone.
 *
 * A baseline keyed to UTC hours would put a user's evening in someone else's
 * afternoon and average the two.
 */
export const contextOf = (date, timeZone = "UTC") => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(date));

  const value = (type) => parts.find((part) => part.type === type)?.value;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    hourOfDay: Number.parseInt(value("hour"), 10),
    dayOfWeek: Math.max(days.indexOf(value("weekday")), 0),
  };
};

/** Records one counterfactual observation. Atomic, so races cannot lose one. */
export const recordBaselineObservation = async ({
  startingMood,
  hourOfDay,
  dayOfWeek,
  delta,
  source,
}) => {
  if (!Number.isFinite(delta) || !Number.isFinite(startingMood)) return null;

  return BaselineCell.findOneAndUpdate(
    { startingMood, hourOfDay, dayOfWeek, source },
    {
      $inc: { observations: 1, sumDelta: delta, sumSquaredDelta: delta * delta },
      $set: { updatedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/**
 * The expected change for this cell with no song signal.
 *
 * Randomized and observational evidence are combined by weight rather than
 * pooled, and the result says which sources it drew on so a caller can be
 * honest about it. Falls back to widening the cell — same mood, any hour —
 * before giving up, because a full (mood × hour × weekday) grid is 840 cells
 * and will be sparse for a long time.
 */
export const baselineFor = async ({ startingMood, hourOfDay, dayOfWeek }) => {
  const exact = await BaselineCell.find({ startingMood, hourOfDay, dayOfWeek }).lean();
  const widened = exact.length
    ? exact
    : await BaselineCell.find({ startingMood }).lean();

  if (widened.length === 0) {
    return { delta: 0, observations: 0, provisional: true, sources: [], widened: false };
  }

  let weighted = 0;
  let weight = 0;
  let observations = 0;

  for (const cell of widened) {
    const w = cell.source === "randomized" ? 1 : OBSERVATIONAL_WEIGHT;
    weighted += cell.sumDelta * w;
    weight += cell.observations * w;
    observations += cell.observations;
  }

  // Same shrinkage discipline as the song ledger: a thin cell is pulled toward
  // "no change" rather than asserting whatever three sessions happened to show.
  const delta = weight > 0 ? weighted / (weight + PRIOR_STRENGTH) : 0;

  return {
    delta,
    observations,
    provisional: observations < MIN_BASELINE_OBSERVATIONS,
    sources: [...new Set(widened.map((cell) => cell.source))],
    widened: exact.length === 0,
  };
};

/** How far a session beat the counterfactual. The quantity worth ranking on. */
export const liftOf = async ({ delta, startingMood, hourOfDay, dayOfWeek }) => {
  const baseline = await baselineFor({ startingMood, hourOfDay, dayOfWeek });
  return { lift: delta - baseline.delta, baseline };
};

/** A pair of check-ins close enough together to compare. */
const MIN_GAP_MS = 30 * 60 * 1000;
const MAX_GAP_MS = 6 * 60 * 60 * 1000;

/**
 * Mines check-in pairs with no listening session between them.
 *
 * A free control group that is already in the database: two check-ins a few
 * hours apart, nothing listened to in between, is exactly the counterfactual
 * the control arm is being built to manufacture. It is observational rather
 * than randomized, so it is stored under its own source and weighted down.
 *
 * Idempotent by construction — it recomputes cells from scratch rather than
 * incrementing, so it can run nightly without double counting.
 */
export const rebuildNoListenBaseline = async ({ timeZone = "UTC" } = {}) => {
  const entries = await MoodEntry.find({ intensity: { $ne: null } })
    .select("userId intensity recordedAt")
    .sort({ userId: 1, recordedAt: 1 })
    .lean();

  const outcomes = await SessionOutcome.find({})
    .select("userId createdAt completedAt")
    .lean();

  const sessionsByUser = outcomes.reduce((map, outcome) => {
    const key = outcome.userId.toString();
    (map[key] ??= []).push(outcome);
    return map;
  }, {});

  const cells = new Map();
  let pairs = 0;

  for (let i = 1; i < entries.length; i += 1) {
    const previous = entries[i - 1];
    const current = entries[i];

    if (previous.userId.toString() !== current.userId.toString()) continue;

    const gap = new Date(current.recordedAt) - new Date(previous.recordedAt);
    if (gap < MIN_GAP_MS || gap > MAX_GAP_MS) continue;

    // Anything listened to in the window makes this not a no-listen pair.
    const overlapped = (sessionsByUser[current.userId.toString()] ?? []).some(
      (outcome) => {
        const at = new Date(outcome.createdAt);
        return at >= new Date(previous.recordedAt) && at <= new Date(current.recordedAt);
      }
    );
    if (overlapped) continue;

    const { hourOfDay, dayOfWeek } = contextOf(previous.recordedAt, timeZone);
    const key = `${previous.intensity}:${hourOfDay}:${dayOfWeek}`;
    const delta = current.intensity - previous.intensity;

    const cell = cells.get(key) ?? {
      startingMood: previous.intensity,
      hourOfDay,
      dayOfWeek,
      observations: 0,
      sumDelta: 0,
      sumSquaredDelta: 0,
    };

    cell.observations += 1;
    cell.sumDelta += delta;
    cell.sumSquaredDelta += delta * delta;
    cells.set(key, cell);
    pairs += 1;
  }

  // Replace wholesale so a re-run is idempotent.
  await BaselineCell.deleteMany({ source: "no_listen" });

  if (cells.size > 0) {
    await BaselineCell.insertMany(
      [...cells.values()].map((cell) => ({ ...cell, source: "no_listen", updatedAt: new Date() }))
    );
  }

  logger.info("no-listen baseline rebuilt", { pairs, cells: cells.size });
  return { pairs, cells: cells.size };
};
