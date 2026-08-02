import MoodEntry from "../../models/MoodEntry.js";
import SessionOutcome from "../../models/SessionOutcome.js";
import { DIRECTIONS } from "../../models/ListeningPlan.js";
import { getPersona } from "../personaService.js";

/**
 * Reading someone's own data and telling them what it suggests.
 *
 * A list of four directions with no reasoning is a menu, and a menu asks the
 * user to diagnose themselves. Everything here is derived from their own
 * check-ins and sessions, and every suggestion carries the numbers that produced
 * it — so the person can disagree with the evidence rather than with a hunch.
 *
 * Suggestions are ranked, never forced: anything on the list can still be
 * chosen, and a suggestion the data cannot support says so.
 */

const WINDOW_DAYS = 60;

/** Below this, nothing here is worth saying out loud. */
const MIN_SAMPLES = 6;

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

const stdDev = (values) => {
  if (values.length < 2) return null;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

const hourBand = (hour) => {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
};

const BAND_LABEL = {
  morning: "mornings",
  afternoon: "afternoons",
  evening: "evenings",
  night: "late nights",
};

/**
 * Everything the suggestions are drawn from, in one pass.
 */
export const analyseForSuggestions = async (userId, timeZone = "UTC") => {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [entries, outcomes, persona] = await Promise.all([
    MoodEntry.find({ userId, recordedAt: { $gte: since } })
      .select("valence intensity arousal recordedAt")
      .lean(),
    SessionOutcome.find({ userId, moodAfter: { $ne: null }, createdAt: { $gte: since } })
      .select("moodBefore moodAfter arousalBefore arousalAfter hourOfDay lift")
      .lean(),
    getPersona(userId),
  ]);

  const readings = entries
    .map((entry) => ({
      valence: entry.valence ?? entry.intensity,
      arousal: entry.arousal ?? null,
      hour: Number.parseInt(
        new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false })
          .format(new Date(entry.recordedAt)),
        10
      ),
    }))
    .filter((reading) => reading.valence != null);

  const byBand = {};
  for (const reading of readings) {
    const band = hourBand(reading.hour);
    (byBand[band] ??= []).push(reading.valence);
  }

  const bandMeans = Object.entries(byBand)
    .filter(([, values]) => values.length >= 2)
    .map(([band, values]) => ({ band, mean: mean(values), samples: values.length }))
    .sort((a, b) => a.mean - b.mean);

  const valences = readings.map((reading) => reading.valence);
  const arousals = readings.map((r) => r.arousal).filter((v) => v != null);

  return {
    samples: readings.length,
    overallMean: mean(valences),
    variability: stdDev(valences),
    arousalMean: mean(arousals),
    arousalSamples: arousals.length,
    hardestBand: bandMeans[0] ?? null,
    easiestBand: bandMeans.at(-1) ?? null,
    measuredSessions: outcomes.length,
    meanLift: mean(outcomes.map((o) => o.lift).filter((v) => v != null)),
    persona,
  };
};

/**
 * Scores each direction against what the data actually shows.
 *
 * A score is only ever a ranking device — the reason string is the part the user
 * reads, and a direction with no supporting evidence gets a neutral one rather
 * than an invented justification.
 */
export const suggestDirections = async (userId, timeZone = "UTC") => {
  const analysis = await analyseForSuggestions(userId, timeZone);

  const enough = analysis.samples >= MIN_SAMPLES;
  const suggestions = [];

  const push = (key, score, reason, evidence = null) =>
    suggestions.push({
      key,
      label: DIRECTIONS[key].label,
      score,
      reason,
      evidence,
      // Says plainly whether this came from their data or is a default, so a
      // suggestion is never mistaken for a finding.
      fromData: Boolean(evidence),
    });

  if (!enough) {
    // With no history, rank by what tends to be a good first plan rather than
    // pretending to have analysed something.
    push("steadier", 3, "A good place to start while there's not much history yet.");
    push("lift", 2, "If the last stretch has been hard, this is the one to pick.");
    push("wind_down", 2, "Pick this if getting to sleep is the problem.");
    push("get_going", 1, "Pick this if mornings are the hardest part.");

    return {
      suggestions: suggestions.sort((a, b) => b.score - a.score),
      analysis: { samples: analysis.samples, enough: false },
    };
  }

  const hardest = analysis.hardestBand;
  const gap =
    hardest && analysis.easiestBand ? analysis.easiestBand.mean - hardest.mean : 0;

  // A time-of-day dip is the clearest signal there is, and it points at a
  // specific direction rather than a general one.
  if (hardest && gap >= 0.5) {
    const label = BAND_LABEL[hardest.band] ?? hardest.band;
    const evidence = {
      band: hardest.band,
      bandMean: Number(hardest.mean.toFixed(2)),
      otherMean: Number(analysis.easiestBand.mean.toFixed(2)),
      samples: hardest.samples,
    };

    if (hardest.band === "evening" || hardest.band === "night") {
      push(
        "wind_down",
        10,
        `Your ${label} average ${evidence.bandMean} against ${evidence.otherMean} the rest of the day — that's the part worth working on.`,
        evidence
      );
    } else if (hardest.band === "morning") {
      push(
        "get_going",
        10,
        `Mornings average ${evidence.bandMean} against ${evidence.otherMean} later on.`,
        evidence
      );
    } else {
      push(
        "lift",
        8,
        `Your ${label} are the low point, averaging ${evidence.bandMean}.`,
        evidence
      );
    }
  }

  // A lot of movement is a different problem from a low average, and it is the
  // one people most often misread as "I'm fine, mostly".
  if (analysis.variability != null && analysis.variability >= 1.0) {
    push(
      "steadier",
      9,
      `Your mood swings a fair amount — around ${analysis.variability.toFixed(1)} points either side of ${analysis.overallMean.toFixed(1)}. Evening things out is often more useful than aiming higher.`,
      {
        variability: Number(analysis.variability.toFixed(2)),
        mean: Number(analysis.overallMean.toFixed(2)),
        samples: analysis.samples,
      }
    );
  }

  if (analysis.overallMean != null && analysis.overallMean <= 2.6) {
    push(
      "lift",
      9,
      `You've been averaging ${analysis.overallMean.toFixed(1)} over the last while. This one aims at the average itself rather than any particular time of day.`,
      {
        mean: Number(analysis.overallMean.toFixed(2)),
        samples: analysis.samples,
      }
    );
  }

  // Anything the data did not argue for still gets offered, without a reason
  // dressed up as one.
  const suggested = new Set(suggestions.map((entry) => entry.key));
  for (const [key, spec] of Object.entries(DIRECTIONS)) {
    if (suggested.has(key)) continue;
    push(key, 1, `Also available — ${spec.label.toLowerCase()}.`);
  }

  // Keep the strongest reason per direction rather than repeating one.
  const best = new Map();
  for (const entry of suggestions.sort((a, b) => b.score - a.score)) {
    if (!best.has(entry.key)) best.set(entry.key, entry);
  }

  const ranked = [...best.values()].sort((a, b) => b.score - a.score);

  return {
    suggestions: ranked,
    analysis: {
      samples: analysis.samples,
      // Having readings is not the same as having something to say about them.
      // Claiming "here is what we suggest" above four shrugs is incoherent.
      enough: ranked.some((entry) => entry.fromData),
      overallMean: analysis.overallMean,
      variability: analysis.variability,
      hardestBand: hardest?.band ?? null,
      measuredSessions: analysis.measuredSessions,
    },
  };
};
