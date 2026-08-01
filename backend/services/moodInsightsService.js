import ListeningFeedback from "../models/ListeningFeedback.js";
import MoodEntry from "../models/MoodEntry.js";
import SessionOutcome from "../models/SessionOutcome.js";
import { buildInsightPrompt } from "../prompts/insightPrompt.js";
import { generateJson } from "./geminiService.js";
import { INSIGHT_SCHEMA } from "./schemas.js";
import logger from "../utils/logger.js";
import { dayKey } from "../utils/dayKey.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MIN_ENTRIES_FOR_INSIGHT = 5;


/**
 * A direction needs two halves to compare, so it needs more entries than the
 * dashboard does to unlock. Naming the threshold keeps the two from drifting;
 * at exactly five entries the dashboard opened and the trend could not be
 * judged, and the client rendered its fallback — "Holding steady" — as though
 * the server had asserted it.
 */
const MIN_ENTRIES_FOR_TREND = 6;

/**
 * Mood words mapped to a -2..+2 valence so a heterogeneous vocabulary can be
 * charted and trended. Unknown moods score 0 rather than being dropped, so a
 * word we have not classified never silently skews the average.
 */
const MOOD_VALENCE = {
  // The five daily check-in labels come first because they are the highest
  // volume input by far. Four of them were missing, so every check-in except
  // "great" scored 0 and the chart was flat for anyone using the feature.
  awful: -2, low: -1, okay: 0, good: 1, great: 2,

  joyful: 2, excited: 2, energetic: 2, accomplished: 2, grateful: 2,
  happy: 2, motivated: 2, hopeful: 1, calm: 1, peaceful: 1, content: 1,
  relaxed: 1, focused: 1, reflective: 0, neutral: 0, contemplative: 0,
  nostalgic: 0, bored: -1, tired: -1, restless: -1, frustrated: -1,
  stressed: -1, anxious: -1, lonely: -1, melancholic: -1, sad: -2,
  angry: -2, hopeless: -2, overwhelmed: -2, depressed: -2, numb: -2,
};

export const valenceOf = (mood) => MOOD_VALENCE[mood?.toLowerCase()] ?? 0;

/**
 * The wall-clock hour and weekday where the user was, not where the server is.
 *
 * These read `getHours()` / `getDay()`, which on Render means UTC — so a
 * check-in at 9pm in India was filed under 15:30 "afternoon" and, near
 * midnight, under the wrong day of the week entirely. The whole point of these
 * two statistics is which part of *their* day is hardest.
 */
const partsIn = (date, timeZone) => {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(date));

  const value = (type) => formatted.find((part) => part.type === type)?.value;

  return {
    hour: Number.parseInt(value("hour"), 10),
    weekday: value("weekday"),
  };
};

const timeOfDay = (date, timeZone) => {
  const { hour } = partsIn(date, timeZone);
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
};

const countBy = (items, keyFn) =>
  items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

const rankDescending = (counts) =>
  Object.entries(counts).sort(([, a], [, b]) => b - a);

/** Average valence per bucket, used for both time-of-day and day-of-week. */
const averageValenceByBucket = (entries, bucketFn) => {
  const totals = {};

  entries.forEach((entry) => {
    const bucket = bucketFn(entry.recordedAt);
    totals[bucket] ??= { sum: 0, count: 0 };
    totals[bucket].sum += valenceOf(entry.mood);
    totals[bucket].count += 1;
  });

  return Object.fromEntries(
    Object.entries(totals).map(([bucket, { sum, count }]) => [bucket, sum / count])
  );
};

const dominantMoodByBucket = (entries, bucketFn) => {
  const grouped = entries.reduce((buckets, entry) => {
    const bucket = bucketFn(entry.recordedAt);
    (buckets[bucket] ??= []).push(entry.mood);
    return buckets;
  }, {});

  return Object.fromEntries(
    Object.entries(grouped).map(([bucket, moods]) => [
      bucket,
      rankDescending(countBy(moods, (mood) => mood))[0][0],
    ])
  );
};

/**
 * Compares the first and second half of the window. A simple split is more
 * honest than a regression line over sparse, irregularly-spaced self-reports.
 */
const describeTrend = (entries) => {
  // A stable key, not a sentence: the client looks the value up in a style map,
  // so a prose fallback silently became whatever the default was.
  if (entries.length < MIN_ENTRIES_FOR_TREND) return "unknown";

  const midpoint = Math.floor(entries.length / 2);
  const mean = (slice) =>
    slice.reduce((sum, entry) => sum + valenceOf(entry.mood), 0) / slice.length;

  const shift = mean(entries.slice(midpoint)) - mean(entries.slice(0, midpoint));

  if (shift > 0.4) return "improving";
  if (shift < -0.4) return "declining";
  return "steady";
};

const buildDailySeries = (entries, timeZone) => {
  const byDay = entries.reduce((days, entry) => {
    // Local calendar day, matching how getDay()/getHours() bucket below. An
    // ISO slice is UTC, so an 11pm check-in in a positive-offset timezone
    // plotted on the chart a day after the day-of-week stats assigned it.
    const key = dayKey(entry.recordedAt, timeZone);
    (days[key] ??= []).push(entry);
    return days;
  }, {});

  return Object.entries(byDay)
    .map(([date, dayEntries]) => ({
      date,
      averageValence:
        dayEntries.reduce((sum, entry) => sum + valenceOf(entry.mood), 0) /
        dayEntries.length,
      dominantMood: rankDescending(countBy(dayEntries, (e) => e.mood))[0][0],
      count: dayEntries.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

const summariseEfficacy = (outcomes) => {
  const measured = outcomes.filter((outcome) => outcome.moodAfter != null);
  const improved = measured.filter((outcome) => outcome.moodAfter > outcome.moodBefore);

  const averageChange = measured.length
    ? measured.reduce((sum, o) => sum + (o.moodAfter - o.moodBefore), 0) / measured.length
    : null;

  return {
    measuredSessions: measured.length,
    improvedSessions: improved.length,
    improvementRate: measured.length ? improved.length / measured.length : null,
    averageMoodChange: averageChange,
  };
};

/**
 * Computes every statistic the dashboard and the AI narrative need.
 * All derivation happens here in code; the model only phrases the result.
 */
export const buildMoodInsights = async (
  userId,
  { periodDays = 30, timeZone = "UTC" } = {}
) => {
  const since = new Date(Date.now() - periodDays * MS_PER_DAY);

  const [entries, outcomes, feedback] = await Promise.all([
    MoodEntry.find({ userId, recordedAt: { $gte: since } })
      .sort({ recordedAt: 1 })
      .lean(),
    SessionOutcome.find({ userId, createdAt: { $gte: since } }).lean(),
    ListeningFeedback.find({ userId, signal: { $in: ["liked", "saved"] } })
      .select("genre")
      .lean(),
  ]);

  const hasEnoughData = entries.length >= MIN_ENTRIES_FOR_INSIGHT;

  const moodCounts = countBy(entries, (entry) => entry.mood);
  const topMoods = rankDescending(moodCounts)
    .slice(0, 5)
    .map(([mood, count]) => ({ mood, count }));

  const valenceByDay = averageValenceByBucket(entries, (date) =>
    partsIn(date, timeZone).weekday
  );
  const rankedDays = Object.entries(valenceByDay).sort(([, a], [, b]) => a - b);

  const topGenres = rankDescending(countBy(feedback, (entry) => entry.genre ?? ""))
    .filter(([genre]) => genre)
    .slice(0, 5)
    .map(([genre]) => genre);

  return {
    hasEnoughData,
    periodDays,
    totalEntries: entries.length,
    minimumEntriesNeeded: MIN_ENTRIES_FOR_INSIGHT,
    minimumEntriesForTrend: MIN_ENTRIES_FOR_TREND,

    series: buildDailySeries(entries, timeZone),
    topMoods,
    trend: describeTrend(entries),

    moodByTimeOfDay: dominantMoodByBucket(entries, (date) =>
      timeOfDay(date, timeZone)
    ),
    moodByDayOfWeek: {
      hardest: rankedDays[0]?.[0] ?? null,
      easiest: rankedDays.at(-1)?.[0] ?? null,
      averages: valenceByDay,
    },

    topGenres,
    efficacy: summariseEfficacy(outcomes),
  };
};

/**
 * The AI-written reflection layered on top of the statistics.
 * Returns null when there is too little data, so the UI can invite the user to
 * keep checking in rather than showing a hollow summary.
 */
export const generateInsightNarrative = async (insights) => {
  if (!insights.hasEnoughData) return null;

  try {
    return await generateJson(buildInsightPrompt(insights), {
      schema: INSIGHT_SCHEMA,
      operation: "insight",
    });
  } catch (error) {
    logger.error("Insight narrative generation failed:", error.message);
    return null;
  }
};
