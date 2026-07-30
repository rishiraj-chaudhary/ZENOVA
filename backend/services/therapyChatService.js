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
import { loadTherapyProfile, recordSession } from "./userProfileService.js";

/** Detects the user's mood and, for signed-in users, appends it to their history. */
export const analyzeMood = async ({
  userId,
  userInput,
  conversationHistory = [],
  region,
}) => {
  const risk = await assessRisk(userInput, { region });

  const profile = await loadTherapyProfile(userId);
  const mood = await generateText(
    buildMoodAnalysisPrompt(userInput, conversationHistory, profile)
  );

  if (!profile.isGuest) {
    await recordMood({ userId, mood, context: userInput, source: "chat" });
  }

  return {
    mood,
    contextUsed: !profile.isGuest,
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

  const response = await generateText(
    risk.level === RISK_LEVELS.ELEVATED
      ? `${ELEVATED_RISK_PROMPT_GUIDANCE}\n\n${basePrompt}`
      : basePrompt
  );

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
