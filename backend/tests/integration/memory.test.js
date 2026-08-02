import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import MemoryItem from "../../models/MemoryItem.js";
import UserModel from "../../models/UserModel.js";
import { CONTEXT_THRESHOLD, confidentBeliefs } from "../../services/memory/compaction.js";
import { cosine, embed, recall } from "../../services/memory/episodicMemory.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const newId = () => new mongoose.Types.ObjectId();

const remember = (userId, summary, { moodValence, moodAtTime, daysAgo = 0 } = {}) =>
  MemoryItem.create({
    userId,
    summary,
    embedding: embed(summary),
    moodAtTime: moodAtTime ?? null,
    moodValence: moodValence ?? null,
    createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
  });

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("embedding and similarity", () => {
  it("scores related text above unrelated text", () => {
    const query = embed("exams are stressing me out");

    const related = cosine(query, embed("exam stress is getting to them"));
    const unrelated = cosine(query, embed("they went to a concert on Saturday"));

    expect(related).toBeGreaterThan(unrelated);
  });

  it("returns a unit vector, so cosine is a dot product", () => {
    const vector = embed("anything at all");
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

    expect(magnitude).toBeCloseTo(1, 5);
  });

  it("handles empty text without dividing by zero", () => {
    expect(embed("").every((value) => value === 0)).toBe(true);
    expect(cosine(embed(""), embed("x"))).toBe(0);
  });
});

describe("recall", () => {
  it("prefers what was said in a similar mood over what was said recently", async () => {
    const userId = newId();

    // Recent, but said while feeling fine.
    await remember(userId, "They talked about a concert they enjoyed", {
      moodValence: 5,
      moodAtTime: "great",
      daysAgo: 1,
    });
    // Older, but said at the same low point they are at now.
    await remember(userId, "They said work has been overwhelming lately", {
      moodValence: 2,
      moodAtTime: "low",
      daysAgo: 30,
    });

    const results = await recall(userId, { currentValence: 2, limit: 2 });

    // The whole reason the mood term exists: when someone is low, what they
    // said last time they were low beats what they said last Tuesday.
    expect(results[0].summary).toMatch(/overwhelming/);
  });

  it("uses the query when one is given", async () => {
    const userId = newId();
    await remember(userId, "They mentioned trouble sleeping before exams");
    await remember(userId, "They asked for something upbeat for the gym");

    const results = await recall(userId, { query: "sleep and exams", limit: 1 });

    expect(results[0].summary).toMatch(/sleeping/);
  });

  it("returns nothing for someone with no memories", async () => {
    expect(await recall(newId(), { query: "anything" })).toEqual([]);
  });

  it("shows one person nothing of another's memories", async () => {
    const mine = newId();
    const theirs = newId();
    await remember(theirs, "Something private they said");

    expect(await recall(mine, { query: "private" })).toEqual([]);
  });
});

describe("the profile only states what it can still stand behind", () => {
  it("hides a belief whose confidence has decayed below the threshold", async () => {
    const profile = {
      recurringStressors: [
        { text: "deadlines at work", confidence: 0.8, lastConfirmed: new Date() },
        { text: "something said once, long ago", confidence: 0.2, lastConfirmed: new Date() },
      ],
      avoid: [],
      copingStrategiesThatWorked: [],
    };

    const beliefs = confidentBeliefs(profile);

    // Stale beliefs stop being asserted; they stay in the record so the user
    // can still see and correct them.
    expect(beliefs.recurringStressors).toEqual(["deadlines at work"]);
    expect(CONTEXT_THRESHOLD).toBeGreaterThan(0.2);
  });

  it("orders by confidence, so the budget spends on the strongest", async () => {
    const beliefs = confidentBeliefs({
      recurringStressors: [
        { text: "weaker", confidence: 0.4, lastConfirmed: new Date() },
        { text: "stronger", confidence: 0.9, lastConfirmed: new Date() },
      ],
    });

    expect(beliefs.recurringStressors).toEqual(["stronger", "weaker"]);
  });

  it("returns empty categories rather than undefined for a new user", async () => {
    const profile = await UserModel.create({ userId: newId() });

    expect(confidentBeliefs(profile.toObject()).recurringStressors).toEqual([]);
  });

  it("says nothing at all when there is no profile", () => {
    expect(confidentBeliefs(null)).toEqual({});
  });
});
