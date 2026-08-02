import PlanStep from "../models/PlanStep.js";
import { adaptPlan } from "../services/plans/planAdaptation.js";
import { computeBehaviour, getBehaviour } from "../services/plans/planBehaviour.js";
import { buildReadout } from "../services/plans/planReadout.js";
import {
  getActivePlan,
  listSteps,
  nextStep,
  previewPlan,
  setStatus,
  startPlan,
} from "../services/plans/planService.js";
import { DIRECTIONS, DURATIONS } from "../models/ListeningPlan.js";
import { beginStep, guidanceFor } from "../services/plans/planGuidance.js";
import { suggestDirections } from "../services/plans/planSuggestions.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * What their own data suggests, ranked, with the numbers behind each.
 *
 * A bare list of four options asks the user to diagnose themselves. Everything
 * here is derived from their check-ins and sessions, and anything the data
 * cannot support says so rather than inventing a reason.
 */
export const getDirections = asyncHandler(async (req, res) => {
  const { suggestions, analysis } = await suggestDirections(
    req.user._id,
    req.user.timeZone
  );

  res.json({
    directions: Object.entries(DIRECTIONS).map(([key, spec]) => ({
      key,
      label: spec.label,
    })),
    durations: DURATIONS,
    suggestions,
    analysis,
  });
});

/** What today's step actually asks for — the songs, the length, the point. */
export const getStepGuidance = asyncHandler(async (req, res) => {
  const plan = await getActivePlan(req.user._id);
  if (!plan) throw AppError.notFound("No plan is running");

  const step =
    (await PlanStep.findOne({ _id: req.params.stepId, userId: req.user._id }).lean()) ??
    (await nextStep(plan._id));

  if (!step) return res.json({ step: null, guidance: null });

  const behaviour = await getBehaviour(plan._id);

  res.json({
    step,
    guidance: await guidanceFor({
      plan,
      step,
      startingMood: behaviour?.trend?.recentMean
        ? Math.round(behaviour.trend.recentMean)
        : plan.baseline?.valence
          ? Math.round(plan.baseline.valence)
          : 3,
    }),
  });
});

/**
 * Turns a step into a live session without leaving the page.
 *
 * The plan used to hand people to the chat, which meant it had described the
 * work and then made them go and organise it themselves.
 */
export const begin = asyncHandler(async (req, res) => {
  res.json(
    await beginStep({
      userId: req.user._id,
      stepId: req.params.stepId,
      moodBefore: req.body.moodBefore,
      arousalBefore: req.body.arousalBefore,
      timeZone: req.user.timeZone,
    })
  );
});

/** What a plan would look like, before committing to anything. */
export const preview = asyncHandler(async (req, res) => {
  res.json(
    await previewPlan(req.user._id, {
      direction: req.body.direction,
      durationDays: Number(req.body.durationDays),
    })
  );
});

export const start = asyncHandler(async (req, res) => {
  const plan = await startPlan(req.user._id, {
    direction: req.body.direction,
    durationDays: Number(req.body.durationDays),
    reminderHour: req.body.reminderHour,
  });

  res.status(201).json({ plan });
});

/**
 * Where they are.
 *
 * Adherence and effect travel together but are never merged — a plan with
 * perfect adherence and no measured movement is a failure the metrics would
 * otherwise call a success.
 */
export const getCurrent = asyncHandler(async (req, res) => {
  const plan = await getActivePlan(req.user._id);
  if (!plan) return res.json({ plan: null });

  const [steps, upcoming, behaviour] = await Promise.all([
    listSteps(plan._id),
    nextStep(plan._id),
    getBehaviour(plan._id),
  ]);

  res.json({
    plan,
    nextStep: upcoming,
    steps: steps.map(({ dayIndex, dueAt, kind, status, sessionId }) => ({
      dayIndex,
      dueAt,
      kind,
      status,
      sessionId,
    })),
    behaviour,
  });
});

export const getReadout = asyncHandler(async (req, res) => {
  const plan = await getActivePlan(req.user._id);
  if (!plan) throw AppError.notFound("No plan is running");

  res.json(await buildReadout(plan));
});

/**
 * Attaches a recommendation to a step, so a session done inside a plan is
 * recognisable as one.
 */
export const attachSession = asyncHandler(async (req, res) => {
  const step = await PlanStep.findOneAndUpdate(
    { _id: req.params.stepId, userId: req.user._id, status: "pending" },
    { sessionId: req.body.sessionId },
    { new: true }
  );

  if (!step) throw AppError.notFound("That step is not available");
  res.json({ step });
});

export const pause = asyncHandler(async (req, res) => {
  res.json({ plan: await setStatus(req.user._id, "paused") });
});

export const resume = asyncHandler(async (req, res) => {
  res.json({ plan: await setStatus(req.user._id, "active") });
});

/** One tap, no confirmation friction, no "are you sure you want to give up". */
export const stop = asyncHandler(async (req, res) => {
  res.json({ plan: await setStatus(req.user._id, "stopped") });
});

/** Recomputes now rather than waiting for the nightly pass. */
export const refresh = asyncHandler(async (req, res) => {
  const plan = await getActivePlan(req.user._id);
  if (!plan) throw AppError.notFound("No plan is running");

  const { applied } = await adaptPlan(plan);
  const behaviour = await computeBehaviour(plan);

  res.json({ adaptations: applied, behaviour });
});
