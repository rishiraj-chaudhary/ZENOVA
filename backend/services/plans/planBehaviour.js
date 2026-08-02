import MoodEntry from "../../models/MoodEntry.js";
import PlanBehaviour from "../../models/PlanBehaviour.js";
import PlanStep from "../../models/PlanStep.js";
import SessionOutcome from "../../models/SessionOutcome.js";

/**
 * How someone is actually behaving inside a plan.
 *
 * Every field here is derived from data the app already collects — no new
 * instrumentation. That is the strongest argument for this feature existing:
 * the measurement substrate was built first, and this is what consumes it.
 *
 * Because it rebuilds from scratch, an adaptation rule can be changed and
 * replayed over history to see what it would have done, rather than shipped and
 * observed.
 */

const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Enough measured sessions before a trend is worth calling a trend. */
export const MIN_TREND_SAMPLES = 4;

export const computeBehaviour = async (plan) => {
  const now = new Date();

  const [steps, outcomes, recentMoods] = await Promise.all([
    PlanStep.find({ planId: plan._id }).lean(),
    SessionOutcome.find({
      userId: plan.userId,
      createdAt: { $gte: plan.startedAt },
      moodAfter: { $ne: null },
    })
      .select("moodBefore moodAfter arousalBefore arousalAfter lift hourOfDay createdAt")
      .sort({ createdAt: 1 })
      .lean(),
    MoodEntry.find({
      userId: plan.userId,
      recordedAt: { $gte: plan.startedAt },
    })
      .select("valence intensity recordedAt")
      .sort({ recordedAt: 1 })
      .lean(),
  ]);

  // Only steps whose moment has passed can be adhered to or missed.
  const dueSteps = steps.filter(
    (step) => step.kind === "session" && new Date(step.dueAt) <= now
  );
  const done = dueSteps.filter((step) => step.status === "done");
  const missed = dueSteps.filter((step) => step.status === "missed");

  const scheduledHours = dueSteps.map((step) => new Date(step.dueAt).getHours());
  const actualHours = outcomes
    .map((outcome) => outcome.hourOfDay)
    .filter((hour) => Number.isInteger(hour));

  const scheduledHourMean = mean(scheduledHours);
  const actualHourMean = mean(actualHours);

  const lifts = outcomes.map((o) => o.lift).filter((value) => value != null);
  const arousalShifts = outcomes
    .filter((o) => o.arousalBefore != null && o.arousalAfter != null)
    .map((o) => o.arousalAfter - o.arousalBefore);

  // Trend uses every reading since the plan started — check-ins and session
  // before-ratings both — because a plan is about the person's baseline
  // shifting, not only about how sessions went.
  const readings = [
    ...recentMoods.map((entry) => entry.valence ?? entry.intensity),
    ...outcomes.map((outcome) => outcome.moodBefore),
  ].filter((value) => value != null);

  const recentMean = mean(readings.slice(-8));
  const change =
    recentMean != null && plan.baseline?.valence != null
      ? recentMean - plan.baseline.valence
      : null;

  const behaviour = {
    planId: plan._id,
    userId: plan.userId,

    adherence: {
      due: dueSteps.length,
      done: done.length,
      missed: missed.length,
      rate: dueSteps.length ? done.length / dueSteps.length : null,
    },

    timing: {
      scheduledHourMean,
      actualHourMean,
      driftHours:
        scheduledHourMean != null && actualHourMean != null
          ? actualHourMean - scheduledHourMean
          : null,
      samples: actualHours.length,
    },

    engagement: {
      // Started listening and never answered the follow-up. A different signal
      // from never starting at all.
      abandoned: await SessionOutcome.countDocuments({
        userId: plan.userId,
        createdAt: { $gte: plan.startedAt },
        listenedAt: { $ne: null },
        moodAfter: null,
      }),
      ratingsGiven: outcomes.length,
    },

    effect: {
      meanLift: mean(lifts),
      meanArousalShift: mean(arousalShifts),
      samples: outcomes.length,
    },

    trend: {
      direction:
        readings.length < MIN_TREND_SAMPLES || change == null
          ? "unknown"
          : change > 0.3
            ? "up"
            : change < -0.3
              ? "down"
              : "flat",
      recentMean,
      change,
      samples: readings.length,
    },

    computedAt: new Date(),
  };

  await PlanBehaviour.findOneAndUpdate({ planId: plan._id }, behaviour, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  return behaviour;
};

export const getBehaviour = (planId) => PlanBehaviour.findOne({ planId }).lean();

/**
 * Marks steps whose day has passed without being done.
 *
 * A missed step is rescheduled once, silently. Nobody needs to be told they
 * failed at listening to music, and a plan that accumulates visible failures is
 * one people stop opening.
 */
export const rollForwardMissedSteps = async (plan) => {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);

  const overdue = await PlanStep.find({
    planId: plan._id,
    kind: "session",
    status: "pending",
    dueAt: { $lt: cutoff },
  }).sort({ dayIndex: 1 });

  let rescheduled = 0;

  for (const step of overdue) {
    // Rescheduled once, then it becomes a miss rather than following someone
    // around for the rest of the plan.
    if (step.status === "rescheduled") continue;

    const nextRest = await PlanStep.findOne({
      planId: plan._id,
      kind: "rest",
      status: "pending",
      dayIndex: { $gt: step.dayIndex },
    }).sort({ dayIndex: 1 });

    if (nextRest) {
      nextRest.kind = "session";
      nextRest.prescription = step.prescription;
      await nextRest.save();
      rescheduled += 1;
    }

    step.status = nextRest ? "rescheduled" : "missed";
    await step.save();
  }

  return { rescheduled, missed: overdue.length - rescheduled };
};
