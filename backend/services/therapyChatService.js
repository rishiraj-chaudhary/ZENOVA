import { buildConversationalPrompt } from "../prompts/conversationPrompt.js";
import { buildMoodAnalysisPrompt } from "../prompts/moodPrompt.js";
import { generateText } from "./geminiService.js";
import { recordMood } from "./moodService.js";
import {
  ELEVATED_RISK_PROMPT_GUIDANCE,
  RISK_LEVELS,
  assessRisk,
  buildCrisisResponse,
} from "./safetyService.js";
import logger from "../utils/logger.js";
import { loadTherapyProfile, recordSession } from "./userProfileService.js";

/**
 * Used when the model is unavailable and the user is at elevated risk. Says
 * only what is true without the model, and keeps the support contacts — which
 * accompany this reply — as the substantive part of the response.
 */
const SUPPORTIVE_FALLBACK_REPLY =
  "I hear you, and I'm sorry things feel this heavy right now. I'm having " +
  "trouble reaching my recommendations at the moment, but what you're feeling " +
  "matters more than a playlist. Please consider talking to someone below.";

/**
 * Detects the user's mood and, for signed-in users, appends it to their history.
 *
 * A crisis disclosure short-circuits before any model call. Previously this
 * endpoint computed the crisis resources, discarded them, and then threw a 500
 * when the unrelated mood call failed — so an explicit suicide disclosure
 * produced an error page instead of a helpline.
 */
export const analyzeMood = async ({
  userId,
  userInput,
  conversationHistory = [],
  region,
}) => {
  const risk = await assessRisk(userInput, { region });

  if (risk.level === RISK_LEVELS.CRISIS) {
    const crisis = buildCrisisResponse(risk);
    return {
      mood: "crisis",
      contextUsed: false,
      riskLevel: crisis.riskLevel,
      message: crisis.response,
      supportResources: crisis.supportResources,
      emergencyNotice: crisis.emergencyNotice,
    };
  }

  const profile = await loadTherapyProfile(userId);

  // Mood detection is advisory. It must never be able to suppress the support
  // information already established above.
  let mood = null;
  try {
    mood = await generateText(
      buildMoodAnalysisPrompt(userInput, conversationHistory, profile),
      { operation: "mood" }
    );
  } catch (error) {
    logger.warn("mood detection failed", { detail: error.message });
  }

  if (mood && !profile.isGuest) {
    await recordMood({ userId, mood, context: userInput, source: "chat" });
  }

  return {
    mood,
    contextUsed: !profile.isGuest,
    degraded: mood === null,
    ...(risk.level !== RISK_LEVELS.NONE && {
      riskLevel: risk.level,
      supportResources: risk.resources,
      emergencyNotice: risk.notice,
    }),
  };
};

/**
 * Produces an empathetic conversational reply grounded in the user's history.
 * A message indicating self-harm short-circuits to support contacts.
 */
export const generateChatReply = async ({
  userId,
  userInput,
  conversationHistory = [],
  region,
}) => {
  const risk = await assessRisk(userInput, { region });
  if (risk.level === RISK_LEVELS.CRISIS) {
    const crisis = buildCrisisResponse(risk);
    return {
      response: crisis.response,
      riskLevel: crisis.riskLevel,
      supportResources: crisis.supportResources,
      emergencyNotice: crisis.emergencyNotice,
      contextUsed: false,
    };
  }

  const profile = await loadTherapyProfile(userId);
  const basePrompt = buildConversationalPrompt(userInput, conversationHistory, profile);

  // At elevated risk the support contacts matter more than the reply, so a
  // model failure degrades to a plain acknowledgement rather than an error.
  let response;
  try {
    response = await generateText(
      risk.level === RISK_LEVELS.ELEVATED
        ? `${ELEVATED_RISK_PROMPT_GUIDANCE}\n\n${basePrompt}`
        : basePrompt,
      { operation: "chat" }
    );
  } catch (error) {
    logger.warn("chat generation failed", { detail: error.message, risk: risk.level });

    if (risk.level === RISK_LEVELS.NONE) throw error;
    response = SUPPORTIVE_FALLBACK_REPLY;
  }

  if (!profile.isGuest) {
    await recordSession(userId, "chat");
  }

  return {
    response,
    contextUsed: !profile.isGuest,
    ...(risk.level === RISK_LEVELS.ELEVATED && {
      riskLevel: risk.level,
      supportResources: risk.resources,
      emergencyNotice: risk.notice,
    }),
  };
};
