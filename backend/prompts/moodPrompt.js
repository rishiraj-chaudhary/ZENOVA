import { wrapUntrusted } from "../utils/untrustedContent.js";
const formatRecentMoods = (moodHistory) =>
  moodHistory.slice(-5).map((entry) => entry.mood).join(", ") || "No previous data";

const formatConversation = (conversationHistory, limit) =>
  conversationHistory
    .slice(-limit)
    .map((message) => `${message.sender}: ${message.text}`)
    .join("\n") || "No previous conversation";

/**
 * Single source of truth for mood detection. Previously duplicated verbatim in
 * musicController and geminiController, which meant tuning the therapeutic
 * framing in one place silently diverged the other.
 */
export const buildMoodAnalysisPrompt = (
  userInput,
  conversationHistory = [],
  userProfile = {}
) => {
  const { moodHistory = [], preferences = [], currentStreak = 0 } = userProfile;

  return `You are an expert music therapist and emotional intelligence AI assistant. Your role is to accurately identify and understand the user's emotional state through their text input.

CONTEXT ANALYSIS:
- User's recent mood patterns: ${formatRecentMoods(moodHistory)}
- Current wellness streak: ${currentStreak} days
- User preferences: ${preferences.join(", ") || "Not specified"}
- Recent conversation context:
${formatConversation(conversationHistory, 3)}

CURRENT USER INPUT:
${wrapUntrusted(userInput, { label: "user message" })}

ANALYSIS FRAMEWORK:
1. PRIMARY EMOTION DETECTION:
   - Identify the dominant emotion (happy, sad, anxious, excited, angry, calm, frustrated, hopeful, lonely, energetic, melancholic, motivated, stressed, peaceful, confused)
   - Consider intensity level (mild, moderate, strong, intense)

2. CONTEXTUAL FACTORS:
   - Look for temporal indicators (today, yesterday, lately, recently)
   - Identify situational triggers (work, relationships, health, achievements, challenges)
   - Note any contradictory emotions or mixed feelings
   - Consider cultural and personal context clues

3. THERAPEUTIC INSIGHTS:
   - Assess if this represents a pattern or change from recent moods
   - Identify any concerning patterns (persistent negativity, mood swings)
   - Note positive developments or progress indicators

4. RESPONSE REQUIREMENTS:
   - Return ONLY a single primary mood word (lowercase)
   - If multiple emotions are present, choose the most therapeutically relevant one
   - Prioritize emotions that would benefit most from music therapy intervention

EXAMPLES:
- "I've been struggling with work stress lately" → "stressed"
- "Finally got that promotion I've been working toward!" → "accomplished"
- "Can't sleep, mind racing with worries" → "anxious"
- "Just want to curl up and listen to something soothing" → "melancholic"
- "Ready to take on the world today!" → "energetic"

Analyze the user's input and respond with a single mood word that best captures their therapeutic needs.`;
};

export { formatConversation, formatRecentMoods };
