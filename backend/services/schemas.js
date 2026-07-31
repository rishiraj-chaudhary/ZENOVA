import { SchemaType } from "@google/generative-ai";

/**
 * Response schemas passed to Gemini's structured-output mode.
 *
 * Constraining generation is what makes the hand-rolled parser unnecessary:
 * the model can no longer emit prose around the JSON, fence it, or write
 * "duration": 4:36 where an integer belongs.
 */

const { OBJECT, ARRAY, STRING, INTEGER } = SchemaType;

export const RECOMMENDATION_SCHEMA = {
  type: OBJECT,
  properties: {
    response: { type: STRING },
    detectedMood: { type: STRING },
    therapeuticGoal: { type: STRING },
    recommendations: {
      type: ARRAY,
      items: {
        type: OBJECT,
        properties: {
          title: { type: STRING },
          artist: { type: STRING },
          genre: { type: STRING },
          moodTags: { type: ARRAY, items: { type: STRING } },
          duration: { type: INTEGER },
          recommendedFor: { type: ARRAY, items: { type: STRING } },
          reason: { type: STRING },
          energyLevel: { type: STRING, enum: ["low", "medium", "high"] },
          therapeuticFunction: {
            type: STRING,
            enum: ["support", "transition", "energize", "calm", "motivate"],
          },
        },
        required: ["title", "artist", "reason"],
      },
    },
  },
  required: ["response", "recommendations"],
};

export const RISK_SCHEMA = {
  type: OBJECT,
  properties: {
    risk: { type: STRING, enum: ["none", "elevated", "crisis"] },
    reason: { type: STRING },
  },
  required: ["risk"],
};

export const INSIGHT_SCHEMA = {
  type: OBJECT,
  properties: {
    headline: { type: STRING },
    summary: { type: STRING },
    observations: { type: ARRAY, items: { type: STRING } },
    suggestion: { type: STRING },
  },
  required: ["headline", "summary"],
};

export const MOOD_SCHEMA = {
  type: OBJECT,
  properties: {
    mood: { type: STRING },
  },
  required: ["mood"],
};
