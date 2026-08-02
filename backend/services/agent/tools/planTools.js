import { buildReadout } from "../../plans/planReadout.js";
import { getBehaviour } from "../../plans/planBehaviour.js";
import { getActivePlan, nextStep, setStatus } from "../../plans/planService.js";
import { registerTool } from "../toolRegistry.js";

/**
 * The assistant as the plan's voice.
 *
 * The verifier matters more here than anywhere else in the app. "You're doing
 * really well" is unfalsifiable; "your evening sessions moved you -1.2 on
 * arousal across 7 measured sessions" is checkable, and the verifier deletes it
 * if the number is not in the tool result. So these tools return numbers, and
 * the model is told to cite them.
 */
export const registerPlanTools = () => {
  registerTool({
    name: "get_my_plan",
    description:
      "The user's current listening plan: what it is aiming at, what today " +
      "asks for, and how far through they are. Returns null if they have no " +
      "plan running — do not invent one.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const plan = await getActivePlan(ctx.userId);
      if (!plan) return { hasPlan: false };

      const [step, behaviour] = await Promise.all([
        nextStep(plan._id),
        getBehaviour(plan._id),
      ]);

      return {
        hasPlan: true,
        direction: plan.direction,
        durationDays: plan.durationDays,
        status: plan.status,
        target: plan.target?.valence ?? null,
        baseline: plan.baseline?.valence ?? null,
        sessionsDone: behaviour?.adherence?.done ?? 0,
        sessionsDue: behaviour?.adherence?.due ?? 0,
        nextStepDueAt: step?.dueAt ?? null,
        nextStepKind: step?.kind ?? null,
      };
    },
  });

  registerTool({
    name: "explain_my_progress",
    description:
      "How the plan is actually going, in numbers. Report adherence and effect " +
      "separately — doing the sessions and the sessions working are different " +
      "things. Never describe a result marked provisional as established, and " +
      "never claim an improvement the numbers do not show.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "read",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const plan = await getActivePlan(ctx.userId);
      if (!plan) return { hasPlan: false };

      const readout = await buildReadout(plan);

      return {
        hasPlan: true,
        daysRun: readout.daysRun,
        durationDays: readout.durationDays,
        sessionsDone: readout.adherence.done,
        sessionsDue: readout.adherence.due,
        effectSummary: readout.effect.headline.text,
        effectSamples: readout.effect.headline.samples,
        effectProvisional: readout.effect.headline.provisional,
        trendDirection: readout.trend.direction,
        baseline: readout.trend.baseline,
        now: readout.trend.now,
        target: readout.trend.target,
        // What the plan changed about itself, so the assistant can explain a
        // change the user noticed rather than being surprised by it.
        adaptations: readout.adaptations.map((entry) => entry.change),
      };
    },
  });

  registerTool({
    name: "pause_plan",
    description:
      "Pause the user's plan. No friction and no persuasion — if they want to " +
      "stop for a while, that is a normal thing to do.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "write",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const plan = await setStatus(ctx.userId, "paused");
      return { paused: true, direction: plan.direction };
    },
  });

  registerTool({
    name: "stop_plan",
    description:
      "End the user's plan for good. Stopping is a normal outcome, not a " +
      "failure — do not try to talk them out of it.",
    inputSchema: { type: "object", properties: {} },
    sideEffect: "write",
    scopes: ["moodTracking"],
    ownership: "self",
    handler: async (_input, ctx) => {
      const plan = await setStatus(ctx.userId, "stopped");
      return { stopped: true, direction: plan.direction };
    },
  });
};

export default registerPlanTools;
