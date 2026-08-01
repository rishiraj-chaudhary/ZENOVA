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
 * Models are cached per (model name, generation config). A schema-constrained
 * model and a free-text one are different objects, so keying on both avoids
 * rebuilding either on every call.
 */
const getModel = (responseSchema, modelName) => {
  const name = modelName ?? config.gemini.model;
  const key = `${name}:${responseSchema ? JSON.stringify(responseSchema) : "text"}`;
  if (modelCache.has(key)) return modelCache.get(key);

  const model = getClient().getGenerativeModel({
    model: name,
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

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRIES_PER_MODEL = 2;
const BASE_BACKOFF_MS = 700;
const UNHEALTHY_COOLDOWN_MS = 60 * 1000;

/**
 * Models recently observed failing, so a persistently overloaded primary is not
 * retried on every single request. Entries expire, letting it recover on its own.
 */
const unhealthyUntil = new Map();

const isHealthy = (name) => (unhealthyUntil.get(name) ?? 0) < Date.now();
const markUnhealthy = (name) => unhealthyUntil.set(name, Date.now() + UNHEALTHY_COOLDOWN_MS);

const isRetryable = (error) =>
  RETRYABLE_STATUSES.has(error?.status) ||
  /\b(503|429|overloaded|unavailable)\b/i.test(error?.message ?? "");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The models to try, in order.
 *
 * An explicit per-call model is honoured alone — callers that pick one are
 * making a cost/latency decision that a silent upgrade would undo.
 */
const candidateModels = (requested) => {
  if (requested) return [requested];

  const chain = [config.gemini.model, ...config.gemini.fallbackModels];
  const healthy = chain.filter(isHealthy);

  // If everything is cooling down, try anyway rather than fail without asking.
  return healthy.length > 0 ? healthy : chain;
};

/**
 * Runs a generation with retry and model failover, recording metrics either way.
 *
 * Upstream 503s are routine — a single overloaded model should degrade quality,
 * not take the feature down.
 */
const generate = async (operation, prompt, responseSchema, modelName) => {
  const models = candidateModels(modelName);
  let lastError;

  for (const name of models) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt += 1) {
      const startedAt = process.hrtime.bigint();

      try {
        const result = await getModel(responseSchema, name).generateContent(prompt);
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

        recordLlmCall({ operation, durationMs, outcome: "success", ...usageOf(result) });
        return result.response.text().trim();
      } catch (error) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        recordLlmCall({ operation, durationMs, outcome: "error" });
        lastError = error;

        // A non-retryable error means *this model* cannot serve the request —
        // it was retired, the name is wrong, the schema is rejected. Aborting
        // the whole chain made the fallback list decorative: when
        // gemini-2.0-flash was retired its 404 took the feature down rather
        // than moving to the next model. Break to the next candidate instead.
        if (!isRetryable(error)) break;

        if (attempt < RETRIES_PER_MODEL) {
          await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        }
      }
    }

    markUnhealthy(name);
    logger.warn("gemini model unavailable, trying next", {
      operation,
      model: name,
      error: lastError?.message?.split("\n")[0]?.slice(0, 120),
    });
  }

  throw lastError;
};

/** Returns the model's raw text response. */
export const generateText = (prompt, { operation = "text", model } = {}) =>
  generate(operation, prompt, undefined, model);

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
export const generateJson = async (prompt, { schema, operation = "json", model } = {}) => {
  const text = await generate(operation, prompt, schema, model);

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
