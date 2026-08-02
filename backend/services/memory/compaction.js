import MemoryItem from "../../models/MemoryItem.js";
import UserModel from "../../models/UserModel.js";
import { generateJson } from "../geminiService.js";
import { acquireLock } from "../../utils/taskLock.js";
import logger from "../../utils/logger.js";
import { wrapUntrusted } from "../../utils/untrustedContent.js";
import { cosine, embed } from "./episodicMemory.js";

/**
 * Promotion from episodic memory to the profile, and decay out of it.
 *
 * The rules are the interesting part, not the storage. Two of them keep this
 * from inventing a personality:
 *
 *  - Nothing is promoted on one remark. A belief needs two independent episodic
 *    items agreeing before it enters the profile at all.
 *  - A belief that stops being reconfirmed loses confidence, and below the
 *    threshold it drops out of the context budget while staying in the record.
 *    Stale beliefs stop being asserted; they are not deleted, because the user
 *    should be able to see what was once thought and correct it.
 *
 * Runs nightly behind the same Mongo-backed lock the leaderboard rebuild uses,
 * so several instances cannot compact the same person at once.
 */
const CATEGORIES = ["recurringStressors", "copingStrategiesThatWorked", "avoid"];

const PROMOTION_THRESHOLD = 2;
const SIMILARITY_FOR_AGREEMENT = 0.45;

const DECAY_AFTER_DAYS = 90;
const DECAY_FACTOR = 0.7;
export const CONTEXT_THRESHOLD = 0.35;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    recurringStressors: { type: "array", items: { type: "string" } },
    copingStrategiesThatWorked: { type: "array", items: { type: "string" } },
    avoid: { type: "array", items: { type: "string" } },
  },
};

/** Candidate beliefs from a window of memories, with nothing promoted yet. */
const extractCandidates = async (memories) => {
  const text = memories.map((memory) => `- ${memory.summary}`).join("\n");

  const result = await generateJson(
    `From these summaries of past conversations, list only things stated more than
once or stated plainly. Short noun phrases. Do not infer personality traits, do
not diagnose, and leave a list empty rather than guessing.

${wrapUntrusted(text, { label: "memory summaries" })}`,
    { schema: EXTRACTION_SCHEMA, operation: "memory_compaction" }
  );

  return result ?? {};
};

/** How many distinct memories support this belief. */
const supportFor = (belief, memories) => {
  const vector = embed(belief);

  return memories.filter((memory) => cosine(vector, memory.embedding ?? []) >= SIMILARITY_FOR_AGREEMENT);
};

const decayed = (belief) => {
  const days = (Date.now() - new Date(belief.lastConfirmed).getTime()) / (24 * 60 * 60 * 1000);
  if (days < DECAY_AFTER_DAYS) return belief;

  return {
    ...belief,
    confidence: Number((belief.confidence * DECAY_FACTOR).toFixed(3)),
  };
};

export const compactUser = async (userId) => {
  const memories = await MemoryItem.find({ userId }).sort({ createdAt: -1 }).limit(120).lean();
  if (memories.length < PROMOTION_THRESHOLD) return { promoted: 0, decayed: 0 };

  const candidates = await extractCandidates(memories);
  const profile =
    (await UserModel.findOne({ userId })) ?? new UserModel({ userId });

  let promoted = 0;

  for (const category of CATEGORIES) {
    const existing = profile[category] ?? [];

    for (const text of candidates[category] ?? []) {
      const support = supportFor(text, memories);

      // The rule that stops a single remark becoming a belief about someone.
      if (support.length < PROMOTION_THRESHOLD) continue;

      const already = existing.find(
        (belief) => cosine(embed(belief.text), embed(text)) >= 0.8
      );

      if (already) {
        already.lastConfirmed = new Date();
        already.confidence = Math.min(1, already.confidence + 0.15);
        continue;
      }

      existing.push({
        text,
        confidence: Math.min(1, 0.4 + 0.1 * support.length),
        sourceMemoryIds: support.slice(0, 5).map((memory) => memory._id),
        firstSeen: new Date(),
        lastConfirmed: new Date(),
      });
      promoted += 1;
    }

    profile[category] = existing.map(decayed);
  }

  const decayedCount = CATEGORIES.reduce(
    (count, category) =>
      count + (profile[category] ?? []).filter((b) => b.confidence < CONTEXT_THRESHOLD).length,
    0
  );

  profile.updatedAt = new Date();
  await profile.save();

  return { promoted, decayed: decayedCount };
};

/** The nightly pass. Locked, so concurrent instances do not duplicate work. */
export const runCompaction = async ({ limit = 50 } = {}) => {
  const acquired = await acquireLock("memory:compaction", 60 * 60 * 1000);
  if (!acquired) return { skipped: true };

  const userIds = await MemoryItem.distinct("userId");
  let promoted = 0;

  for (const userId of userIds.slice(0, limit)) {
    try {
      const result = await compactUser(userId);
      promoted += result.promoted;
    } catch (error) {
      logger.warn("compaction failed for a user", { detail: error.message });
    }
  }

  logger.info("memory compaction complete", { users: userIds.length, promoted });
  return { users: userIds.length, promoted };
};

/** Only beliefs still confident enough to be worth stating. */
export const confidentBeliefs = (profile) => {
  if (!profile) return {};

  return Object.fromEntries(
    CATEGORIES.map((category) => [
      category,
      (profile[category] ?? [])
        .filter((belief) => belief.confidence >= CONTEXT_THRESHOLD)
        .sort((a, b) => b.confidence - a.confidence)
        .map((belief) => belief.text),
    ])
  );
};
