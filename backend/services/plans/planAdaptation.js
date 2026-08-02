import ListeningPlan from "../../models/ListeningPlan.js";
import PlanStep from "../../models/PlanStep.js";
import logger from "../../utils/logger.js";
import { computeBehaviour, rollForwardMissedSteps } from "./planBehaviour.js";

/**
 * Changing the plan when the evidence says to.
 *
 * Five rules, each with an explicit trigger, an evidence threshold and a logged
 * change. No model decides whether to adapt — a model may word a change, but
 * the decision is deterministic, so the policy can be reviewed, tested, and
 * replayed over history before a threshold is altered.
 *
 * One rule matters more than the other four: a downward trend never increases
 * demand. A plan is not the right tool for a week that is getting worse, and
 * pretending otherwise is the most harmful thing this feature could do.
 */

const ADHERENCE_FLOOR = 0.5;
const MIN_STEPS_BEFORE_JUDGING_ADHERENCE = 3;

const DRIFT_HOURS = 2;
const MIN_DRIFT_SAMPLES = 4;

const MIN_EFFECT_SAMPLES = 5;

/** Conservative on purpose: firing this on noise would be worse than missing it. */
const DETERIORATION_DROP = 0.8;
const MIN_DETERIORATION_SAMPLES = 4;

const MIN_GRADUATION_SAMPLES = 5;

/** How far behind a checkpoint counts as off the route rather than just slow. */
const OFF_COURSE_GAP = 0.4;
const MIN_OFF_COURSE_SAMPLES = 3;

/** Listening plenty on their own while ignoring the plan's sessions. */
const ENGAGED_ELSEWHERE_PLAYS = 15;

/** Never asks for more than the plan started with. */
const MIN_STEPS_PER_WEEK = 2;

/**
 * The checkpoint the plan should have passed by now, and whether it did.
 *
 * Marks reached and missed as it goes, so the same checkpoint is not judged
 * twice and the read-out can show which parts of the route went to plan.
 */
const checkRoute = (plan, behaviour) => {
  const dayIndex = plan.startedAt
    ? Math.floor((Date.now() - new Date(plan.startedAt).getTime()) / 86_400_000)
    : 0;

  const due = plan.milestones.filter(
    (milestone) => milestone.dayIndex <= dayIndex && !milestone.reached && !milestone.missedAt
  );

  if (due.length === 0) return null;

  const latest = due.at(-1);
  const axis = latest.axis ?? "valence";

  // Compared on the checkpoint's own axis. A wind-down plan is behind when
  // arousal has not come down, which has nothing to do with valence.
  const actual =
    axis === "arousal"
      ? behaviour.effect.meanArousalShift != null && plan.baseline?.arousal != null
        ? plan.baseline.arousal + behaviour.effect.meanArousalShift
        : null
      : behaviour.trend.recentMean;

  if (actual == null) return null;

  const expected = latest.targetValue ?? latest.targetValence;
  if (expected == null) return null;

  // Lower is better on a downward arousal target, so the sign flips.
  const wantsLower = axis === "arousal" && plan.baseline?.arousal != null &&
    expected < plan.baseline.arousal;
  const gap = wantsLower ? actual - expected : expected - actual;

  if (gap <= 0) {
    latest.reached = true;
    latest.reachedAt = new Date();
    return { milestone: latest, onCourse: true, gap };
  }

  latest.missedAt = new Date();
  return { milestone: latest, onCourse: false, gap };
};

/**
 * Changes the route rather than the destination.
 *
 * Being behind is not a reason to demand more — that is the mistake every
 * step-count app makes. It is a reason to change what the remaining steps
 * actually do: a different kind of session, drawn from a wider pool, at the
 * time of day that has been working.
 */
const rerouteRemaining = async (plan, { therapeuticFunction }) => {
  const upcoming = await PlanStep.find({
    planId: plan._id,
    kind: "session",
    status: "pending",
    dueAt: { $gt: new Date() },
  });

  for (const step of upcoming) {
    step.prescription = {
      therapeuticFunction,
      targetArousalShift: step.prescription?.targetArousalShift ?? 0,
    };
    await step.save();
  }

  return upcoming.length;
};

/** What to try instead of whatever has not been working. */
const NEXT_APPROACH = {
  calm: "support",
  energize: "motivate",
  support: "calm",
  motivate: "energize",
};

const alreadyFired = (plan, trigger, withinHours = 72) => {
  const cutoff = Date.now() - withinHours * 60 * 60 * 1000;

  return plan.adaptations.some(
    (adaptation) =>
      adaptation.trigger === trigger && new Date(adaptation.at).getTime() > cutoff
  );
};

/**
 * Lowers the ask.
 *
 * Repeating a demand louder does not make it easier to meet. When someone is
 * not managing the plan, the plan is wrong, not the person.
 */
const reduceFrequency = async (plan) => {
  const next = Math.max(MIN_STEPS_PER_WEEK, plan.stepsPerWeek - 1);
  if (next === plan.stepsPerWeek) return null;

  // Turn the latest pending session of each week into a rest, from the end
  // backwards, so what is already coming up stays stable.
  const upcoming = await PlanStep.find({
    planId: plan._id,
    kind: "session",
    status: "pending",
    dueAt: { $gt: new Date() },
  }).sort({ dayIndex: -1 });

  const toRelease = Math.ceil(upcoming.length / plan.stepsPerWeek);
  for (const step of upcoming.slice(0, toRelease)) {
    step.kind = "rest";
    await step.save();
  }

  plan.stepsPerWeek = next;
  return next;
};

/** Moves future steps to the hour they have actually been turning up at. */
const moveSchedule = async (plan, hour) => {
  const upcoming = await PlanStep.find({
    planId: plan._id,
    status: "pending",
    dueAt: { $gt: new Date() },
  });

  for (const step of upcoming) {
    const dueAt = new Date(step.dueAt);
    dueAt.setHours(hour, 0, 0, 0);
    step.dueAt = dueAt;
    await step.save();
  }

  plan.reminderHour = hour;
  return upcoming.length;
};

/** Drops everything to rests and check-ins, without ending the plan. */
const softenToRest = async (plan) => {
  const upcoming = await PlanStep.find({
    planId: plan._id,
    kind: "session",
    status: "pending",
    dueAt: { $gt: new Date() },
  });

  for (const step of upcoming) {
    step.kind = "check_in";
    await step.save();
  }

  return upcoming.length;
};

const RULES = [
  {
    trigger: "deterioration",
    /**
     * Evaluated first, and it stops everything after it.
     *
     * If someone is going downhill, no other adaptation should run — moving
     * their schedule around or dropping a prescription type is noise at that
     * moment, and increasing anything would be actively harmful.
     */
    terminal: true,
    fires: (behaviour) =>
      behaviour.trend.samples >= MIN_DETERIORATION_SAMPLES &&
      behaviour.trend.change != null &&
      behaviour.trend.change <= -DETERIORATION_DROP,
    apply: async (plan, behaviour) => {
      const softened = await softenToRest(plan);

      return {
        evidence: {
          change: Number(behaviour.trend.change.toFixed(2)),
          samples: behaviour.trend.samples,
        },
        change:
          "Things have been harder lately, so we've eased the plan right back — " +
          "just check-ins for now, no sessions to keep up with. Your safety plan " +
          "is on the Settings page, and talking to someone you trust is worth more " +
          "than anything this app can do.",
        softened,
        surfaceSafetyPlan: true,
      };
    },
  },

  {
    trigger: "rapid_improvement",
    fires: (behaviour, plan) =>
      behaviour.trend.samples >= MIN_GRADUATION_SAMPLES &&
      plan.target?.valence != null &&
      behaviour.trend.recentMean != null &&
      behaviour.trend.recentMean >= plan.target.valence,
    apply: async (plan, behaviour) => ({
      evidence: {
        recentMean: Number(behaviour.trend.recentMean.toFixed(2)),
        target: plan.target.valence,
        samples: behaviour.trend.samples,
      },
      // Padding out a plan that already worked would be dishonest.
      change:
        "You've reached what this plan was aiming for. You can finish here, or " +
        "keep going — neither is better than the other.",
      offerGraduation: true,
    }),
  },

  {
    trigger: "off_course",
    fires: (behaviour, plan) => {
      if (plan.milestones.length === 0) return false;
      if (behaviour.trend.samples < MIN_OFF_COURSE_SAMPLES) return false;

      const route = checkRoute(plan, behaviour);
      return Boolean(route && !route.onCourse && route.gap >= OFF_COURSE_GAP);
    },
    apply: async (plan, behaviour) => {
      const current = plan.milestones.find((m) => m.missedAt)?.targetValence ?? null;
      const currentFunction =
        (await PlanStep.findOne({ planId: plan._id, kind: "session" }))?.prescription
          ?.therapeuticFunction ?? "support";

      const next = NEXT_APPROACH[currentFunction] ?? "support";
      const changed = await rerouteRemaining(plan, { therapeuticFunction: next });

      return {
        evidence: {
          expected: current,
          actual: behaviour.trend.recentMean
            ? Number(behaviour.trend.recentMean.toFixed(2))
            : null,
          samples: behaviour.trend.samples,
          from: currentFunction,
          to: next,
        },
        // Not "you are behind" — the plan changing course, which is the plan's
        // job rather than the person's.
        change:
          "You're not quite where this was heading by now, so we've changed " +
          `what the remaining sessions do rather than asking for more of them. ` +
          `The next ${changed} are a different approach.`,
        rerouted: changed,
      };
    },
  },

  {
    trigger: "engaged_elsewhere",
    fires: (behaviour) =>
      behaviour.adherence.due >= 2 &&
      behaviour.adherence.rate != null &&
      behaviour.adherence.rate < 0.5 &&
      (behaviour.listening?.playsSincePlanStarted ?? 0) >= ENGAGED_ELSEWHERE_PLAYS,
    apply: async (plan, behaviour) => {
      const hour = behaviour.listening?.commonHour;
      if (hour != null) await moveSchedule(plan, hour);

      return {
        evidence: {
          plays: behaviour.listening.playsSincePlanStarted,
          adherence: Number(behaviour.adherence.rate.toFixed(2)),
          movedTo: hour,
        },
        // They are listening plenty. The plan is asking at the wrong moment,
        // not asking too much.
        change:
          hour != null
            ? `You've been listening plenty — just not when the plan asked. We've moved it to around ${String(hour).padStart(2, "0")}:00, where you already are.`
            : "You've been listening plenty, just not to the plan's sessions. We'll keep the plan light and fit around it.",
      };
    },
  },

  {
    trigger: "low_adherence",
    fires: (behaviour) =>
      behaviour.adherence.due >= MIN_STEPS_BEFORE_JUDGING_ADHERENCE &&
      behaviour.adherence.rate != null &&
      behaviour.adherence.rate < ADHERENCE_FLOOR,
    apply: async (plan, behaviour) => {
      const next = await reduceFrequency(plan);
      if (!next) return null;

      return {
        evidence: {
          rate: Number(behaviour.adherence.rate.toFixed(2)),
          due: behaviour.adherence.due,
        },
        change: `We've dropped to ${next} sessions a week — the plan was asking for more than it needed to.`,
      };
    },
  },

  {
    trigger: "time_drift",
    fires: (behaviour) =>
      behaviour.timing.samples >= MIN_DRIFT_SAMPLES &&
      behaviour.timing.driftHours != null &&
      Math.abs(behaviour.timing.driftHours) >= DRIFT_HOURS,
    apply: async (plan, behaviour) => {
      const hour = Math.round(behaviour.timing.actualHourMean);
      await moveSchedule(plan, hour);

      const display = `${String(hour).padStart(2, "0")}:00`;

      return {
        evidence: {
          scheduled: Math.round(behaviour.timing.scheduledHourMean),
          actual: hour,
          samples: behaviour.timing.samples,
        },
        // They told you when they would do it, by doing it.
        change: `We've moved your sessions to around ${display} — that's when you actually listen.`,
      };
    },
  },

  {
    trigger: "no_measured_effect",
    fires: (behaviour) =>
      behaviour.effect.samples >= MIN_EFFECT_SAMPLES &&
      behaviour.effect.meanLift != null &&
      behaviour.effect.meanLift <= 0,
    apply: async (plan, behaviour) => ({
      evidence: {
        meanLift: Number(behaviour.effect.meanLift.toFixed(2)),
        samples: behaviour.effect.samples,
      },
      // The causal evidence earning its place: this is the app admitting its own
      // prescription is not working for this person.
      change:
        "These sessions haven't been shifting much for you, so we're changing " +
        "what they play rather than asking you to keep doing the same thing.",
      widenSelection: true,
    }),
  },
];

/**
 * Evaluates every rule for one plan.
 *
 * A rule that fired in the last three days does not fire again — otherwise a
 * persistent condition would rewrite the plan nightly and the user would watch
 * it thrash.
 */
export const adaptPlan = async (planDoc) => {
  const plan = planDoc.save ? planDoc : await ListeningPlan.findById(planDoc._id);
  if (!plan || plan.status !== "active") return { applied: [] };

  await rollForwardMissedSteps(plan);
  const behaviour = await computeBehaviour(plan);

  const applied = [];

  for (const rule of RULES) {
    if (alreadyFired(plan, rule.trigger)) continue;
    if (!rule.fires(behaviour, plan)) continue;

    const result = await rule.apply(plan, behaviour);
    if (!result) continue;

    plan.adaptations.push({
      trigger: rule.trigger,
      evidence: result.evidence,
      change: result.change,
    });

    applied.push({ trigger: rule.trigger, ...result });

    if (rule.terminal) break;
  }

  if (applied.length > 0) {
    await plan.save();
    logger.info("plan adapted", {
      triggers: applied.map((entry) => entry.trigger),
    });
  }

  return { applied, behaviour };
};

/** The nightly pass over every running plan. */
export const adaptAllPlans = async ({ limit = 200 } = {}) => {
  const plans = await ListeningPlan.find({ status: "active" }).limit(limit);

  let adapted = 0;
  for (const plan of plans) {
    try {
      const { applied } = await adaptPlan(plan);
      if (applied.length > 0) adapted += 1;
    } catch (error) {
      logger.warn("could not adapt a plan", { detail: error.message });
    }
  }

  return { plans: plans.length, adapted };
};

/** Closes plans whose last day has passed. */
export const completeFinishedPlans = async () => {
  const { modifiedCount } = await ListeningPlan.updateMany(
    { status: "active", endsAt: { $lte: new Date() } },
    { status: "completed", completedAt: new Date() }
  );

  return { completed: modifiedCount };
};

export const THRESHOLDS = {
  ADHERENCE_FLOOR,
  DRIFT_HOURS,
  MIN_EFFECT_SAMPLES,
  DETERIORATION_DROP,
  MIN_DETERIORATION_SAMPLES,
};
