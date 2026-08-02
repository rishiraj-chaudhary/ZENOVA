import { DIRECTIONS } from "../../models/ListeningPlan.js";
import { MIN_TREND_SAMPLES, computeBehaviour } from "./planBehaviour.js";

/**
 * What the plan actually found.
 *
 * Not a congratulation. Adherence and effect are reported side by side and
 * never merged, because a plan with perfect adherence and no measured movement
 * is a failure the metrics would otherwise call a success.
 *
 * Everything here uses the same vocabulary as the rest of the app: a result
 * with too few sessions behind it says so rather than being stated.
 */
const describe = (value, samples, { unit = "", inverted = false } = {}) => {
  if (value == null || samples < MIN_TREND_SAMPLES) {
    return { text: "too few sessions to say", provisional: true, value, samples };
  }

  const magnitude = Math.abs(value);
  const helped = inverted ? value < 0 : value > 0;

  if (magnitude < 0.2) {
    return { text: "no measurable change", provisional: false, value, samples };
  }

  return {
    text: `${value > 0 ? "+" : ""}${value.toFixed(1)}${unit} on average`,
    helped,
    provisional: samples < 8,
    value,
    samples,
  };
};

export const buildReadout = async (plan) => {
  const behaviour = await computeBehaviour(plan);
  const spec = DIRECTIONS[plan.direction];

  const daysRun = plan.startedAt
    ? Math.min(
        plan.durationDays,
        Math.ceil((Date.now() - new Date(plan.startedAt).getTime()) / 86_400_000)
      )
    : 0;

  // The direction they picked decides which axis the headline reports on.
  const onArousalAxis = spec.arousalShift !== null && spec.arousalShift !== 0;

  const headline = onArousalAxis
    ? describe(behaviour.effect.meanArousalShift, behaviour.effect.samples, {
        // Winding down means arousal going *down*, so a negative number is the
        // good outcome and the copy must not call it a decline.
        inverted: spec.arousalShift < 0,
      })
    : describe(behaviour.effect.meanLift, behaviour.effect.samples);

  return {
    direction: plan.direction,
    label: spec.label,
    daysRun,
    durationDays: plan.durationDays,
    status: plan.status,

    // Did they do it. Deliberately first, and deliberately separate.
    adherence: {
      done: behaviour.adherence.done,
      due: behaviour.adherence.due,
      rate: behaviour.adherence.rate,
    },

    // Did it work. A different question with a different answer.
    effect: {
      headline,
      lift: describe(behaviour.effect.meanLift, behaviour.effect.samples),
      arousalShift: describe(
        behaviour.effect.meanArousalShift,
        behaviour.effect.samples,
        { inverted: spec.arousalShift < 0 }
      ),
    },

    trend: {
      direction: behaviour.trend.direction,
      baseline: plan.baseline?.valence ?? null,
      now: behaviour.trend.recentMean,
      target: plan.target?.valence ?? null,
      change: behaviour.trend.change,
      samples: behaviour.trend.samples,
    },

    // What the plan changed about itself, and why. Shown, not hidden.
    adaptations: plan.adaptations.map((adaptation) => ({
      at: adaptation.at,
      change: adaptation.change,
      trigger: adaptation.trigger,
    })),

    /**
     * Stopping is a normal outcome presented as one. There is no "give up"
     * anywhere in this feature.
     */
    nextOptions: ["repeat", "adjust", "stop"],
  };
};
