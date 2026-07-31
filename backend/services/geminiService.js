import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/environment.js";
import AppError from "../utils/AppError.js";
import { recordLlmCall } from "../utils/llmMetrics.js";
import logger from "../utils/logger.js";

const modelCache = new Map();

const getClient = () => {
  if (!config.gemini.apiKey) {
    throw AppError.badGateway("AI service is not configured");
  }
  return new GoogleGenerativeAI(config.gemini.apiKey);
};

/**
 * Models are cached per generation config. A schema-constrained model and a
 * free-text one are different objects, so keying on the schema avoids
 * rebuilding either on every call.
 */
const getModel = (responseSchema) => {
  const key = responseSchema ? JSON.stringify(responseSchema) : "text";
  if (modelCache.has(key)) return modelCache.get(key);

  const model = getClient().getGenerativeModel({
    model: config.gemini.model,
    ...(responseSchema && {
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    }),
  });

  modelCache.set(key, model);
  return model;
};

const usageOf = (result) => ({
  promptTokens: result.response?.usageMetadata?.promptTokenCount ?? 0,
  outputTokens: result.response?.usageMetadata?.candidatesTokenCount ?? 0,
});

/** Runs a generation, recording latency, tokens and outcome either way. */
const generate = async (operation, prompt, responseSchema) => {
  const startedAt = process.hrtime.bigint();

  try {
    const result = await getModel(responseSchema).generateContent(prompt);
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    recordLlmCall({ operation, durationMs, outcome: "success", ...usageOf(result) });
    return result.response.text().trim();
  } catch (error) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    recordLlmCall({ operation, durationMs, outcome: "error" });
    throw error;
  }
};

/** Returns the model's raw text response. */
export const generateText = (prompt, { operation = "text" } = {}) =>
  generate(operation, prompt);

/**
 * Generates schema-constrained JSON.
 *
 * With a schema the model returns bare JSON, so no extraction is needed. The
 * previous implementation stripped code fences, brace-scanned for an object and
 * regex-patched "duration": 4:36 into seconds — all of which existed only
 * because generation was unconstrained.
 *
 * Returns null on a parse failure so callers can fall back rather than fail.
 */
export const generateJson = async (prompt, { schema, operation = "json" } = {}) => {
  const text = await generate(operation, prompt, schema);

  try {
    return JSON.parse(text);
  } catch (error) {
    logger.warn("gemini returned unparseable JSON", {
      operation,
      error: error.message,
      preview: text.slice(0, 120),
    });
    recordLlmCall({ operation, durationMs: 0, outcome: "parse_error" });
    return null;
  }
};
