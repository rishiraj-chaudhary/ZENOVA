import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/environment.js";
import AppError from "../utils/AppError.js";

let cachedModel = null;

const getModel = () => {
  if (!config.gemini.apiKey) {
    throw AppError.badGateway("AI service is not configured");
  }
  if (!cachedModel) {
    const client = new GoogleGenerativeAI(config.gemini.apiKey);
    cachedModel = client.getGenerativeModel({ model: config.gemini.model });
  }
  return cachedModel;
};

/** Returns the model's raw text response. */
export const generateText = async (prompt) => {
  const result = await getModel().generateContent(prompt);
  return result.response.text().trim();
};

/**
 * Models often wrap JSON in ```json fences or surround it with prose, and
 * sometimes emit "duration": 4:36 which is not valid JSON. Normalising here
 * keeps every caller from reinventing its own parser.
 */
const extractJsonCandidate = (text) => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1];

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  return text.slice(start, end + 1);
};

const normalizeDurations = (json) =>
  json.replace(
    /"duration":\s*(\d+):(\d+)/g,
    (_match, minutes, seconds) =>
      `"duration": ${Number(minutes) * 60 + Number(seconds)}`
  );

/**
 * Generates content and parses it as JSON. Returns null when the model produced
 * nothing parseable, letting callers fall back rather than failing the request.
 */
export const generateJson = async (prompt) => {
  const text = await generateText(prompt);
  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    console.warn("Gemini returned no JSON payload");
    return null;
  }

  try {
    return JSON.parse(normalizeDurations(candidate));
  } catch (error) {
    console.warn("Failed to parse Gemini JSON response:", error.message);
    return null;
  }
};
