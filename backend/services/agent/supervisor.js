import { RISK_LEVELS, assessRisk } from "../safetyService.js";

/**
 * Risk assessment, running beside the agent rather than inside it.
 *
 * This is not a step in the chain, and the distinction is the whole point. A
 * chain step can be routed around by a planner, skipped when a budget runs out,
 * or suppressed by an injection that reaches the model before it. Running in
 * parallel against the *unmodified* user message, holding a veto over whatever
 * the agent produced, means the only way to get an unsafe response out is for
 * the supervisor itself to fail — and a supervisor failure marks the response
 * degraded rather than letting it through.
 *
 * It sees the raw turn. Not the assembled context, not the tool results, not
 * anything the model has touched.
 */
export const assess = (rawMessage, { region } = {}) =>
  assessRisk(rawMessage, { region }).catch((error) => ({
    // A classifier that fell over is not a clean bill of health.
    level: RISK_LEVELS.NONE,
    degraded: true,
    resources: [],
    notice: null,
    error: error.message,
  }));

/**
 * Whether the agent's response may be delivered.
 *
 * At crisis level nothing the agent produced is sent. The person gets support
 * contacts, because a conversation about music is not the response to that
 * moment, and the agent may have spent its turn planning a playlist.
 */
export const vetoes = (risk) => risk.level === RISK_LEVELS.CRISIS;

export const supervisedResponse = (risk) => ({
  response:
    "It sounds like you're going through something really painful right now, and " +
    "I want to make sure you get proper support — more than a playlist can offer. " +
    "Please consider reaching out to someone who can help. You deserve to be heard " +
    "by a real person.",
  riskLevel: risk.level,
  supportResources: risk.resources,
  emergencyNotice: risk.notice,
  recommendations: [],
});
