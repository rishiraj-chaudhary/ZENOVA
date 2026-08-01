import MusicResource from "../../../models/MusicResource.js";
import { buildMoodInsights } from "../../moodInsightsService.js";
import { getRecentOutcomes } from "../../outcomeService.js";
import {
  MIN_OBSERVATIONS,
  getEffectForSong,
  getLedgerCoverage,
  provenSongsFor,
} from "../../songEffectService.js";
import { buildTasteProfile } from "../../tasteService.js";
import { registerTool } from "../toolRegistry.js";

/**
 * The read tools.
 *
 * Every one of them wraps a service that already exists and already reports its
 * own uncertainty — provisional song effects, unknown trends, coverage counts.
 * That is what makes the verifier possible: the numbers the assistant states
 * come from these results, so a claim can be re-derived and checked rather than
 * judged by another model.
 */
export const registerReadTools = () => {
  registerTool({
    name: "get_mood_trend",
    description:
      "The user's mood over a recent window: direction, most frequent moods, " +
      "hardest day of the week and roughest time of day. Returns 'unknown' for " +
      "the direction when there are too few check-ins to compare halves.",
    inputSchema: {
      type: "object",
      properties: {
        windowDays: { type: "integer", minimum: 7, maximum: 365, default: 30 },
      },
    },
    sideEffect: "read",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ windowDays }, ctx) => {
      const insights = await buildMoodInsights(ctx.userId, {
        periodDays: windowDays,
        timeZone: ctx.timeZone,
      });

      return {
        trend: insights.trend,
        totalEntries: insights.totalEntries,
        hasEnoughData: insights.hasEnoughData,
        topMoods: insights.topMoods,
        hardestDay: insights.moodByDayOfWeek?.hardest ?? null,
        moodByTimeOfDay: insights.moodByTimeOfDay,
      };
    },
  });

  registerTool({
    name: "get_what_works_for_me",
    description:
      "Songs measured to have helped this user, and songs measured to have " +
      "helped people who started in the same state. Each carries how many " +
      "sessions it rests on and whether that is enough to be conclusive. " +
      "Never present an 'insufficient' or 'provisional' result as established.",
    inputSchema: {
      type: "object",
      properties: {
        startingMood: { type: "integer", minimum: 1, maximum: 5 },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
      },
    },
    sideEffect: "read",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ startingMood, limit }, ctx) => {
      const proven = await provenSongsFor(ctx.userId, { startingMood, limit });

      const ids = [...proven.personal, ...proven.population].map((e) => e.musicId);
      const songs = await MusicResource.find({ _id: { $in: ids } })
        .select("title artist")
        .lean();
      const byId = new Map(songs.map((song) => [song._id.toString(), song]));

      const shape = (entry) => ({
        title: byId.get(entry.musicId.toString())?.title ?? "unknown",
        artist: byId.get(entry.musicId.toString())?.artist ?? "unknown",
        averageChange: Number(entry.meanDelta?.toFixed(2) ?? 0),
        sessions: entry.observations,
        evidence: entry.evidence,
      });

      return {
        personal: proven.personal.map(shape),
        population: proven.population.map(shape),
        conclusiveAt: MIN_OBSERVATIONS,
      };
    },
  });

  registerTool({
    name: "get_effect_of_song",
    description:
      "The measured effect of one specific song for people who started at a " +
      "given mood, with the sample size and confidence interval.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 200 },
        startingMood: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["title", "startingMood"],
    },
    sideEffect: "read",
    ownership: "public",
    handler: async ({ title, startingMood }) => {
      const song = await MusicResource.findOne({
        title: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      })
        .select("title artist")
        .lean();

      if (!song) return { found: false, title };

      const effect = await getEffectForSong(song._id, startingMood);
      if (!effect) return { found: true, measured: false, title: song.title };

      return {
        found: true,
        measured: true,
        title: song.title,
        artist: song.artist,
        averageChange: Number(effect.meanDelta.toFixed(2)),
        sessions: effect.observations,
        evidence: effect.evidence,
        interval: [
          Number(effect.confidenceLow.toFixed(2)),
          Number(effect.confidenceHigh.toFixed(2)),
        ],
      };
    },
  });

  registerTool({
    name: "get_session_history",
    description:
      "The user's recent measured listening sessions: mood before, mood after, " +
      "and the change.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 5 } },
    },
    sideEffect: "read",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async ({ limit }, ctx) => {
      const outcomes = await getRecentOutcomes(ctx.userId, limit);

      return {
        sessions: outcomes.map((outcome) => ({
          moodBefore: outcome.moodBefore,
          moodAfter: outcome.moodAfter,
          change: outcome.moodAfter - outcome.moodBefore,
          at: outcome.createdAt,
        })),
      };
    },
  });

  registerTool({
    name: "get_my_taste",
    description:
      "Genres this user has liked and skipped, from their explicit ratings.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    ownership: "self",
    handler: async (_input, ctx) => buildTasteProfile(ctx.userId),
  });

  registerTool({
    name: "get_measurement_coverage",
    description:
      "How much measured evidence exists overall. Use this to be honest about " +
      "how much the system can actually claim.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    ownership: "public",
    handler: async () => getLedgerCoverage(),
  });
};

export default registerReadTools;
