import { EMERGENCY_NOTICE, getCrisisResources } from "../config/crisisResources.js";
import { generateJson } from "./geminiService.js";

export const RISK_LEVELS = {
  NONE: "none",
  ELEVATED: "elevated",
  CRISIS: "crisis",
};

/**
 * Fast, deterministic first pass. Runs before any model call so that a Gemini
 * outage, rate limit or bad parse can never cause a crisis message to be
 * treated as an ordinary request.
 *
 * Deliberately over-inclusive: a false positive shows someone a helpline they
 * did not need, a false negative does not show one to someone who did.
 */
const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+my\s?self\b/i,
  /\bkms\b/i,
  /\bsuicid(e|al)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live|wake\s+up)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+(reason|point)\s+(to\s+live|in\s+living)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bhurt(ing)?\s+my\s?self\b/i,
  /\bself[-\s]?harm/i,
  /\bcut(ting)?\s+my\s?self\b/i,
  /\boverdos(e|ing)\b/i,
];

const ELEVATED_PATTERNS = [
  /\bhopeless\b/i,
  /\bworthless\b/i,
  /\bcan'?t\s+(go\s+on|take\s+(it|this)\s+anymore|cope)\b/i,
  /\bgiving\s+up\b/i,
  /\bnothing\s+matters\b/i,
  /\bcompletely\s+alone\b/i,
  /\bnumb\b/i,
  /\bempty\s+inside\b/i,
];

const matchesAny = (patterns, text) => patterns.some((pattern) => pattern.test(text));

const screenWithPatterns = (text) => {
  if (matchesAny(CRISIS_PATTERNS, text)) return RISK_LEVELS.CRISIS;
  if (matchesAny(ELEVATED_PATTERNS, text)) return RISK_LEVELS.ELEVATED;
  return RISK_LEVELS.NONE;
};

const CLASSIFIER_PROMPT = (text) => `You are a safety classifier for a music wellbeing app. Assess ONLY the risk level in the message below. Do not respond to the user, offer advice, or recommend music.

MESSAGE: "${text}"

Return JSON exactly:
{"risk": "none" | "elevated" | "crisis", "reason": "brief justification"}

DEFINITIONS:
- "crisis": any reference to suicide, self-harm, wanting to die, or being in danger now
- "elevated": persistent hopelessness, worthlessness, feeling unable to cope, or severe isolation without explicit self-harm reference
- "none": ordinary sadness, stress, frustration, boredom or any other everyday emotion

When uncertain between two levels, choose the HIGHER risk level.`;

/**
 * Second pass for phrasing the patterns miss. Only runs when the deterministic
 * screen found nothing, and only escalates — it can never downgrade a pattern
 * match, so a model failure cannot suppress a detected crisis.
 */
const screenWithModel = async (text) => {
  try {
    const result = await generateJson(CLASSIFIER_PROMPT(text));
    const risk = result?.risk;
    return Object.values(RISK_LEVELS).includes(risk) ? risk : RISK_LEVELS.NONE;
  } catch (error) {
    console.warn("Safety classifier unavailable:", error.message);
    return RISK_LEVELS.NONE;
  }
};

/**
 * Assesses a user message for self-harm risk.
 * Returns { level, resources, notice } — resources are populated for any
 * non-none level so the client can always render support.
 */
export const assessRisk = async (text, { region } = {}) => {
  if (!text?.trim()) return { level: RISK_LEVELS.NONE };

  const patternLevel = screenWithPatterns(text);
  const level =
    patternLevel === RISK_LEVELS.NONE ? await screenWithModel(text) : patternLevel;

  if (level === RISK_LEVELS.NONE) return { level };

  return {
    level,
    resources: getCrisisResources(region),
    notice: EMERGENCY_NOTICE,
  };
};

/**
 * The response shown instead of song recommendations when risk is CRISIS.
 *
 * Recommending "songs for sadness validation" to someone describing self-harm
 * is the exact failure this replaces. Music is not withheld as punishment —
 * it is simply not the right response, and a person is.
 */
export const buildCrisisResponse = ({ resources, notice }) => ({
  response:
    "It sounds like you're going through something really painful right now, and I want to make sure you get proper support — more than a playlist can offer. Please consider reaching out to someone who can help. You deserve to be heard by a real person.",
  riskLevel: RISK_LEVELS.CRISIS,
  supportResources: resources,
  emergencyNotice: notice,
  recommendations: [],
});

/** Prepended to the recommendation prompt when risk is ELEVATED. */
export const ELEVATED_RISK_PROMPT_GUIDANCE = `
SAFETY CONTEXT — READ FIRST:
This user's message suggests they may be struggling significantly. For this response:
- Lead with warmth and validation before anything else
- Do NOT recommend songs that dwell on despair, hopelessness or self-destruction
- Favour songs offering steadiness, comfort, companionship or gentle hope
- Gently mention that talking to someone they trust can help
- Never imply that music alone will resolve what they are feeling
`;
