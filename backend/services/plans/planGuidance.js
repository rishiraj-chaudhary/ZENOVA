import MusicResource from "../../models/MusicResource.js";
import Recommendation from "../../models/Recommendation.js";
import PlanStep from "../../models/PlanStep.js";
import { rankWithExploration } from "../banditService.js";
import { explorationTemperature, getPersona } from "../personaService.js";
import { recordImpressions } from "../policyService.js";
import { startSession } from "../outcomeService.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";

/**
 * What to actually do, rather than where to go and do it.
 *
 * A plan that says "start a session" and drops the person into the chat has
 * handed the work back: they still have to decide what to listen to, for how
 * long, and what they were meant to be doing differently. A step should arrive
 * with the songs already chosen, the length stated, and the point of it in one
 * sentence.
 *
 * Songs come from the effect ledger rather than a fresh model call. That is both
 * better — the plan should play what has been measured to work for this person —
 * and it means a step still works when the language model is unavailable.
 */

/** How long a session should run, per direction. Short enough to actually do. */
const MINUTES = { calm: 20, energize: 12, support: 15, motivate: 15 };

const HOW_TO = {
  calm: [
    "Somewhere you can sit still — not while doing something else.",
    "Lights low if you can. Phone face down.",
    "Let it run. You don't have to concentrate on it.",
  ],
  energize: [
    "Stand up, or at least sit up.",
    "Play it out loud rather than through headphones if you can.",
    "Move to it if you feel like it — that's the point.",
  ],
  support: [
    "No particular setup. This one's just company.",
    "Do something low-effort alongside it if sitting still is hard.",
  ],
  motivate: [
    "Pick one small thing to do while it plays.",
    "It doesn't matter what — the music is the easy part.",
  ],
};

const PURPOSE = {
  calm: "Bringing your energy down before sleep.",
  energize: "Getting your energy up enough to start the day.",
  support: "Keeping things level rather than pushing them anywhere.",
  motivate: "Nudging the day in a better direction.",
};

/**
 * The songs for a step.
 *
 * Drawn from what has measured lift for someone starting in this state, with
 * exploration set by how adventurous this person's own listening is. Falls back
 * to the catalogue by genre when the ledger has nothing yet — a new user should
 * still get a real step rather than an apology.
 */
const chooseSongs = async (userId, { startingMood, therapeuticFunction, limit = 4 }) => {
  const persona = await getPersona(userId);
  const temperature = explorationTemperature(persona);

  const { ranked, suppressed } = await rankWithExploration(startingMood ?? 3, {
    temperature,
    limit,
  });

  if (ranked.length > 0) {
    const songs = await MusicResource.find({
      _id: { $in: ranked.map((entry) => entry.musicId) },
    })
      .select("title artist albumArt spotifyUri previewUrl genre")
      .lean();

    const byId = new Map(songs.map((song) => [song._id.toString(), song]));

    const chosen = ranked
      .map((entry) => ({ ...entry, song: byId.get(entry.musicId.toString()) }))
      .filter((entry) => entry.song);

    if (chosen.length > 0) {
      return {
        songs: chosen.map((entry) => ({
          musicId: entry.musicId,
          ...entry.song,
          // Said plainly per song, so an exploration pick is never presented as
          // a considered one.
          evidence: entry.evidence,
          sessions: entry.observations,
          propensity: entry.propensity,
        })),
        source: "measured",
        suppressed: suppressed.length,
      };
    }
  }

  // Nothing measured yet. Pick by therapeutic function so the step still has a
  // shape, and say where it came from.
  const fallback = await MusicResource.find({
    therapeuticFunction,
    spotifyUri: { $nin: [null, ""] },
  })
    .limit(limit)
    .select("title artist albumArt spotifyUri previewUrl genre")
    .lean();

  return {
    songs: fallback.map((song) => ({
      musicId: song._id,
      ...song,
      evidence: "unmeasured",
      sessions: 0,
    })),
    source: "catalogue",
    suppressed: 0,
  };
};

/** Everything the user needs to do this step, without leaving the page. */
export const guidanceFor = async ({ plan, step, startingMood }) => {
  const fn = step.prescription?.therapeuticFunction ?? "support";

  if (step.kind === "rest") {
    return {
      kind: "rest",
      title: "Rest day",
      purpose: "Nothing to do today. Plans that ask for something daily get dropped.",
      howTo: [],
      minutes: 0,
      songs: [],
    };
  }

  if (step.kind === "check_in") {
    return {
      kind: "check_in",
      title: "Just a check-in",
      purpose: "How you're doing, that's all. No session today.",
      howTo: ["Two taps — how good you feel, and how much energy you have."],
      minutes: 1,
      songs: [],
    };
  }

  const { songs, source, suppressed } = await chooseSongs(plan.userId, {
    startingMood,
    therapeuticFunction: fn,
  });

  return {
    kind: "session",
    title: `${MINUTES[fn] ?? 15} minutes — ${fn}`,
    purpose: PURPOSE[fn] ?? PURPOSE.support,
    howTo: HOW_TO[fn] ?? HOW_TO.support,
    minutes: MINUTES[fn] ?? 15,
    songs,
    songSource: source,
    // Worth surfacing: the plan actively removed something measured to make
    // things worse for this person.
    suppressedCount: suppressed,
  };
};

/**
 * Turns a step into a live measured session.
 *
 * Creates the recommendation, links it to the step, logs the impressions with
 * their real propensities, and opens the before-rating — so the plan page can
 * run the whole thing without handing the user off to another screen.
 */
export const beginStep = async ({ userId, stepId, moodBefore, arousalBefore, timeZone }) => {
  const step = await PlanStep.findOne({ _id: stepId, userId });
  if (!step) throw AppError.notFound("That step is not yours");
  if (step.status === "done") throw AppError.conflict("That step is already done");
  if (step.kind === "rest") throw AppError.badRequest("Rest days have nothing to start");

  const { default: ListeningPlan } = await import("../../models/ListeningPlan.js");
  const plan = await ListeningPlan.findById(step.planId).lean();
  if (!plan) throw AppError.notFound("That plan no longer exists");

  const guidance = await guidanceFor({ plan, step, startingMood: moodBefore });

  const recommendation = await Recommendation.create({
    userId,
    detectedMood: null,
    therapeuticGoal: guidance.purpose,
    recommendedMusic: guidance.songs.map((song) => ({
      musicId: song.musicId,
      reason: `Part of your plan — ${guidance.purpose.toLowerCase()}`,
      therapeuticFunction: step.prescription?.therapeuticFunction,
    })),
  });

  step.sessionId = recommendation._id;
  await step.save();

  // The plan's own sessions are impressions like any other, so they are
  // evaluable off-policy alongside everything else.
  recordImpressions({
    userId,
    sessionId: recommendation._id,
    recommendations: guidance.songs,
    propensities: Object.fromEntries(
      guidance.songs
        .filter((song) => song.propensity)
        .map((song) => [song.musicId.toString(), song.propensity])
    ),
    arm: "policy",
    startingMood: moodBefore,
    timeZone,
  }).catch(() => {});

  await startSession({
    userId,
    sessionId: recommendation._id,
    moodBefore,
    arousalBefore,
    timeZone,
  });

  logger.info("plan step begun", { source: guidance.songSource });

  return { step, sessionId: recommendation._id, guidance };
};
