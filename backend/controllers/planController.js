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
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

/** What plans are on offer, and what each one aims at. */
export const getDirections = asyncHandler(async (req, res) => {
  res.json({
    directions: Object.entries(DIRECTIONS).map(([key, spec]) => ({
      key,
      label: spec.label,
    })),
    durations: DURATIONS,
  });
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
