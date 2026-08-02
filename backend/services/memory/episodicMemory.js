import MemoryItem from "../../models/MemoryItem.js";
import { generateJson } from "../geminiService.js";
import logger from "../../utils/logger.js";
import { wrapUntrusted } from "../../utils/untrustedContent.js";

/**
 * Episodic memory: what was said, compressed, with the mood it was said in.
 *
 * Retrieval blends three signals rather than relying on similarity alone,
 * because "what did they say about this" is usually the wrong question. The
 * useful one is "what did they say when they felt like this".
 */
const WEIGHT_SIMILARITY = 0.55;
const WEIGHT_RECENCY = 0.25;
const WEIGHT_CONTEXT = 0.2;

const RECENCY_HALF_LIFE_DAYS = 45;

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One or two sentences, third person, factual, no advice",
    },
    worthRemembering: {
      type: "boolean",
      description: "False for small talk or anything the user would not want kept",
    },
  },
  required: ["summary", "worthRemembering"],
};

/**
 * A cheap deterministic embedding.
 *
 * A bag-of-character-trigrams hashed into a fixed vector. Not a language model
 * embedding, and it does not pretend to be — but it needs no extra API call per
 * turn, no vector database, and it captures enough lexical overlap to make
 * retrieval better than recency alone. The interface is a vector, so swapping in
 * a real embedding later changes one function.
 */
const DIMENSIONS = 256;

export const embed = (text = "") => {
  const vector = new Array(DIMENSIONS).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");

  for (let i = 0; i < normalized.length - 2; i += 1) {
    const trigram = normalized.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < trigram.length; j += 1) {
      hash = (hash * 31 + trigram.charCodeAt(j)) % DIMENSIONS;
    }
    vector[hash] += 1;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude > 0 ? vector.map((value) => value / magnitude) : vector;
};

export const cosine = (a = [], b = []) => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
  return dot;
};

/**
 * Writes one memory for a turn-pair.
 *
 * The model decides whether an exchange is worth keeping at all — most are not,
 * and a memory store full of "user said hi" makes retrieval worse rather than
 * better.
 */
export const rememberTurn = async ({ userId, runId, userMessage, reply, mood, moodValence }) => {
  try {
    const result = await generateJson(
      `Summarise this exchange in one or two factual sentences, third person, for a
memory the assistant will read later. Say what the person disclosed or asked for.
No advice, no interpretation of their character.

${wrapUntrusted(`user: ${userMessage}\nassistant: ${reply}`, { label: "exchange" })}`,
      { schema: SUMMARY_SCHEMA, operation: "memory_summary" }
    );

    if (!result?.worthRemembering || !result.summary) return null;

    return await MemoryItem.create({
      userId,
      runId,
      summary: result.summary,
      embedding: embed(result.summary),
      moodAtTime: mood ?? null,
      moodValence: moodValence ?? null,
    });
  } catch (error) {
    // Memory is an enhancement. Losing one must never fail the turn.
    logger.debug("could not write memory", { detail: error.message });
    return null;
  }
};

const recencyDecay = (createdAt) => {
  const days = (Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000);
  return 0.5 ** (days / RECENCY_HALF_LIFE_DAYS);
};

/** 1 when the moods match, falling off with distance on the 1-5 scale. */
const contextMatch = (itemValence, currentValence) => {
  if (!itemValence || !currentValence) return 0.5;
  return 1 - Math.abs(itemValence - currentValence) / 4;
};

/**
 * The most relevant memories for this moment.
 *
 * Scored in process over one person's own items — a few hundred at most — which
 * is fast enough that a vector index would be infrastructure for its own sake.
 */
export const recall = async (userId, { query, currentValence, limit = 5 } = {}) => {
  const items = await MemoryItem.find({ userId })
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  if (items.length === 0) return [];

  const queryVector = query ? embed(query) : null;

  return items
    .map((item) => ({
      item,
      score:
        (queryVector ? WEIGHT_SIMILARITY * cosine(queryVector, item.embedding) : 0) +
        WEIGHT_RECENCY * recencyDecay(item.createdAt) +
        WEIGHT_CONTEXT * contextMatch(item.moodValence, currentValence),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item, score }) => ({
      summary: item.summary,
      moodAtTime: item.moodAtTime,
      at: item.createdAt,
      score: Number(score.toFixed(3)),
    }));
};

export const forgetMemory = (userId, memoryId) =>
  MemoryItem.deleteOne({ _id: memoryId, userId });

export const listMemories = (userId, limit = 100) =>
  MemoryItem.find({ userId }).sort({ createdAt: -1 }).limit(limit).select("summary moodAtTime createdAt").lean();
