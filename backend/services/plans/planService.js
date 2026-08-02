import ListeningPlan, { DIRECTIONS, DURATIONS } from "../../models/ListeningPlan.js";
import MoodEntry from "../../models/MoodEntry.js";
import PlanBehaviour from "../../models/PlanBehaviour.js";
import PlanStep from "../../models/PlanStep.js";
import AppError from "../../utils/AppError.js";
import logger from "../../utils/logger.js";
import { getPersona, peakListeningHour } from "../personaService.js";

/**
 * Enrolling someone in a plan, and laying out what it asks of them.
 */

/** Enough history to say anything about someone's own range. */
const MIN_HISTORY_SAMPLES = 8;
const HISTORY_WINDOW_DAYS = 90;

/** Where a plan aims when there is no history to derive a target from. */
const MODEST_IMPROVEMENT = 0.5;

/** Never ask for something every single day; plans that do get abandoned. */
const STEPS_PER_WEEK = { 7: 5, 14: 4, 28: 3 };

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/**
 * Where this person has been, over the window the target is drawn from.
 *
 * Uses `valence` where the two-dimensional reading exists and falls back to the
 * one-dimensional intensity, so someone who predates the affect grid still gets
 * a real baseline rather than nothing.
 */
export const summariseHistory = async (userId) => {
  const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const entries = await MoodEntry.find({
    userId,
    recordedAt: { $gte: since },
    $or: [{ valence: { $ne: null } }, { intensity: { $ne: null } }],
  })
    .select("valence arousal intensity recordedAt")
    .sort({ recordedAt: 1 })
    .lean();

  const readings = entries.map((entry) => ({
    valence: entry.valence ?? entry.intensity,
    arousal: entry.arousal ?? null,
    at: entry.recordedAt,
  }));

  if (readings.length === 0) {
    return { samples: 0, currentMean: null, bestWeekMean: null, arousalMean: null };
  }

  // Weekly means, so "your best week" is a level actually sustained rather than
  // one good afternoon. Bucketed by whole weeks back from the most recent
  // reading rather than by calendar week, so a run that straddles a Sunday is
  // not split into two thin weeks that both look unrepresentative.
  const latest = new Date(readings.at(-1).at).getTime();
  const byWeek = new Map();

  for (const reading of readings) {
    const weeksAgo = Math.floor(
      (latest - new Date(reading.at).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    if (!byWeek.has(weeksAgo)) byWeek.set(weeksAgo, []);
    byWeek.get(weeksAgo).push(reading.valence);
  }

  const weeklyMeans = [...byWeek.values()]
    .filter((week) => week.length >= 2)
    .map(mean)
    .filter((value) => value != null);

  const recent = readings.slice(-14).map((reading) => reading.valence);

  return {
    samples: readings.length,
    currentMean: mean(recent),
    bestWeekMean: weeklyMeans.length ? Math.max(...weeklyMeans) : null,
    arousalMean: mean(readings.map((r) => r.arousal).filter((v) => v != null)),
  };
};

/**
 * What the plan aims at.
 *
 * Derived from a level this person has actually reached, because a target
 * someone has hit before is achievable and checkable, and "be happy" is
 * neither. Where there is not enough history to find one, that is said rather
 * than papered over with an invented personal number.
 */
/** A target has to be meaningfully above where they are, or it is not a target. */
const MEANINGFUL_GAP = 0.25;

export const deriveTarget = (direction, history) => {
  const spec = DIRECTIONS[direction];

  /**
   * A personal target needs a better week to aim at.
   *
   * When every reading falls in one week — a new user, or someone who has only
   * just started checking in — "your best week" and "this week" are the same
   * number, and the derived target lands exactly where they already are. A plan
   * that aims at no change is not a plan, so that case falls through to the
   * modest default rather than producing a confident-looking nothing.
   */
  const enoughHistory =
    history.samples >= MIN_HISTORY_SAMPLES &&
    history.bestWeekMean != null &&
    history.currentMean != null &&
    history.bestWeekMean - history.currentMean >= MEANINGFUL_GAP;

  if (!enoughHistory) {
    const from = history.currentMean ?? 3;

    return {
      valence:
        spec.valenceShift === null
          ? null
          : Math.min(5, from + MODEST_IMPROVEMENT * Math.sign(spec.valenceShift || 1)),
      arousal:
        spec.arousalShift === null
          ? null
          : Math.max(1, Math.min(5, (history.arousalMean ?? 3) + spec.arousalShift)),
      basis: "modest_default",
      evidence: { samples: history.samples, reason: "not enough history yet" },
    };
  }

  // Most of the way back to their own best, not all of it — the last stretch of
  // a personal best is the hardest and a target nobody reaches is demoralising.
  const reach = history.currentMean + (history.bestWeekMean - history.currentMean) * 0.7;

  return {
    valence: spec.valenceShift === null ? null : Number(reach.toFixed(2)),
    arousal:
      spec.arousalShift === null
        ? null
        : Math.max(1, Math.min(5, (history.arousalMean ?? 3) + spec.arousalShift)),
    basis: "personal_best_week",
    evidence: {
      bestWeekMean: Number(history.bestWeekMean.toFixed(2)),
      currentMean: Number(history.currentMean.toFixed(2)),
      samples: history.samples,
    },
  };
};

/**
 * The hour to schedule into.
 *
 * Their existing pattern, not a template's idea of when people should listen. A
 * 9am step for somebody who never opens the app before 8pm is a step that will
 * be missed, and the plan should fit the life rather than the reverse.
 */
const scheduleHourFor = (direction, persona) => {
  if (direction === "wind_down") return 21;
  if (direction === "get_going") return 8;

  return peakListeningHour(persona) ?? 19;
};

/**
 * Lays out the days.
 *
 * Sessions and rests are interleaved rather than front-loaded, so a missed day
 * never lands next to another demand.
 */
export const buildSteps = ({ plan, hour, startedAt }) => {
  const spec = DIRECTIONS[plan.direction];
  const perWeek = plan.stepsPerWeek;
  const steps = [];

  // Spread sessions evenly across each week rather than clustering them.
  const gap = 7 / perWeek;
  const sessionDays = new Set();
  for (let week = 0; week * 7 < plan.durationDays; week += 1) {
    for (let i = 0; i < perWeek; i += 1) {
      const day = week * 7 + Math.round(i * gap);
      if (day < plan.durationDays) sessionDays.add(day);
    }
  }

  for (let day = 0; day < plan.durationDays; day += 1) {
    const dueAt = new Date(startedAt);
    dueAt.setDate(dueAt.getDate() + day);
    dueAt.setHours(hour, 0, 0, 0);

    steps.push({
      planId: plan._id,
      userId: plan.userId,
      dayIndex: day,
      dueAt,
      kind: sessionDays.has(day) ? "session" : "rest",
      prescription: {
        therapeuticFunction: spec.therapeuticFunction,
        targetArousalShift: spec.arousalShift ?? 0,
      },
    });
  }

  return steps;
};

/** What a plan would look like, without committing to it. */
export const previewPlan = async (userId, { direction, durationDays }) => {
  if (!DIRECTIONS[direction]) throw AppError.badRequest("Unknown direction");
  if (!DURATIONS.includes(durationDays)) throw AppError.badRequest("Unsupported length");

  const [history, persona] = await Promise.all([
    summariseHistory(userId),
    getPersona(userId),
  ]);

  const target = deriveTarget(direction, history);
  const hour = scheduleHourFor(direction, persona);
  const stepsPerWeek = STEPS_PER_WEEK[durationDays];

  const draft = {
    _id: null,
    userId,
    direction,
    durationDays,
    stepsPerWeek,
  };

  const steps = buildSteps({ plan: draft, hour, startedAt: new Date() });

  return {
    direction,
    label: DIRECTIONS[direction].label,
    durationDays,
    stepsPerWeek,
    scheduleHour: hour,
    baseline: {
      valence: history.currentMean,
      arousal: history.arousalMean,
      samples: history.samples,
    },
    target,
    sessionCount: steps.filter((step) => step.kind === "session").length,
    restCount: steps.filter((step) => step.kind === "rest").length,
  };
};

/** Commits to it. One live plan per person. */
export const startPlan = async (userId, { direction, durationDays, reminderHour }) => {
  const existing = await ListeningPlan.findOne({
    userId,
    status: { $in: ["draft", "active", "paused"] },
  });

  if (existing) {
    // Two plans at once would make every measurement ambiguous about which one
    // caused it.
    throw AppError.conflict("You already have a plan running. Finish or stop it first.");
  }

  const preview = await previewPlan(userId, { direction, durationDays });
  const startedAt = new Date();
  const endsAt = new Date(startedAt);
  endsAt.setDate(endsAt.getDate() + durationDays);

  const plan = await ListeningPlan.create({
    userId,
    direction,
    durationDays,
    status: "active",
    stepsPerWeek: preview.stepsPerWeek,
    baseline: preview.baseline,
    target: preview.target,
    reminderHour: reminderHour ?? preview.scheduleHour,
    startedAt,
    endsAt,
  });

  await PlanStep.insertMany(
    buildSteps({
      plan,
      hour: reminderHour ?? preview.scheduleHour,
      startedAt,
    })
  );

  logger.info("plan started", { direction, durationDays, basis: preview.target.basis });
  return plan;
};

export const getActivePlan = (userId) =>
  ListeningPlan.findOne({ userId, status: { $in: ["active", "paused"] } }).lean();

export const listSteps = (planId) =>
  PlanStep.find({ planId }).sort({ dayIndex: 1 }).lean();

/**
 * The next thing the plan is asking for.
 *
 * Steps are due, never overdue: a step whose day has passed and which was not
 * done is still offered, because "you missed this" is not a message a plan
 * should lead with.
 */
export const nextStep = async (planId) => {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  return PlanStep.findOne({
    planId,
    status: "pending",
    kind: { $ne: "rest" },
    dueAt: { $lte: endOfToday },
  })
    .sort({ dayIndex: 1 })
    .lean();
};

/** Pausing and stopping are first-class, with no friction and no guilt. */
export const setStatus = async (userId, status) => {
  const plan = await ListeningPlan.findOneAndUpdate(
    { userId, status: { $in: ["active", "paused"] } },
    {
      status,
      ...(status === "stopped" || status === "completed"
        ? { completedAt: new Date() }
        : {}),
    },
    { new: true }
  );

  if (!plan) throw AppError.notFound("No plan is running");
  return plan;
};

export const deletePlansFor = async (userId) => {
  const plans = await ListeningPlan.find({ userId }).select("_id").lean();
  const ids = plans.map((plan) => plan._id);

  await Promise.all([
    ListeningPlan.deleteMany({ userId }),
    PlanStep.deleteMany({ userId }),
    PlanBehaviour.deleteMany({ planId: { $in: ids } }),
  ]);
};
