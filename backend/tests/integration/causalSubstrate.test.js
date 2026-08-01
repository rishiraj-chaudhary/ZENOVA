import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import BaselineCell from "../../models/BaselineCell.js";
import Impression from "../../models/Impression.js";
import MoodEntry from "../../models/MoodEntry.js";
import Recommendation from "../../models/Recommendation.js";
import SessionOutcome from "../../models/SessionOutcome.js";
import User from "../../models/user.js";
import {
  baselineFor,
  contextOf,
  liftOf,
  rebuildNoListenBaseline,
  recordBaselineObservation,
} from "../../services/baselineService.js";
import { completeSession, startSession } from "../../services/outcomeService.js";
import { assignArm, recordImpressions } from "../../services/policyService.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const newId = () => new mongoose.Types.ObjectId();

let counter = 0;
const consentingUser = async (timeZone = "UTC") => {
  counter += 1;
  const user = await User.create({
    name: `Causal-${counter}`,
    email: `causal-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
    timeZone,
    consent: { moodTracking: true, grantedAt: new Date() },
  });
  return user._id;
};

const openSession = async (userId) => {
  const recommendation = await Recommendation.create({
    userId,
    detectedMood: "low",
    recommendedMusic: [{ musicId: newId(), reason: "test" }],
  });
  return recommendation._id;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("impressions", () => {
  it("records one row per served candidate, with a propensity", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await recordImpressions({
      userId,
      sessionId,
      recommendations: [{ musicId: newId() }, { musicId: newId() }, { musicId: newId() }],
      arm: "policy",
      startingMood: 2,
      detectedMood: "low",
      timeZone: "UTC",
    });

    const rows = await Impression.find({ sessionId }).sort({ position: 1 });

    expect(rows).toHaveLength(3);
    // Deterministic ranker today, so every candidate had the same chance. The
    // value is in the field existing from the start, not in its current value.
    expect(rows.every((row) => row.propensity === 1 / 3)).toBe(true);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(rows[0].context.startingMood).toBe(2);
  });

  it("does not double-count a replayed recommendation", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);
    const musicId = newId();

    const serve = () =>
      recordImpressions({
        userId,
        sessionId,
        recommendations: [{ musicId }],
        arm: "policy",
        startingMood: 3,
        timeZone: "UTC",
      });

    await serve();
    await serve();

    expect(await Impression.countDocuments({ sessionId })).toBe(1);
  });

  it("labels the control arm with its own policy version", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await recordImpressions({
      userId,
      sessionId,
      recommendations: [{ musicId: newId() }],
      arm: "control",
      startingMood: 2,
      timeZone: "UTC",
    });

    const [row] = await Impression.find({ sessionId });
    expect(row.arm).toBe("control");
    // A replay must never confuse control impressions with policy ones.
    expect(row.policyVersion).toBe("control-random-v1");
  });

  it("assigns arms at roughly the configured rate", () => {
    const arms = Array.from({ length: 4000 }, assignArm);
    const controlShare = arms.filter((arm) => arm === "control").length / arms.length;

    // 5% ± a wide tolerance; this asserts the mechanism, not the RNG.
    expect(controlShare).toBeGreaterThan(0.02);
    expect(controlShare).toBeLessThan(0.09);
  });
});

describe("the baseline", () => {
  it("shrinks a thin cell toward no change", async () => {
    // Two sessions that happened to rise by 3 should not assert a +3 baseline.
    for (const delta of [3, 3]) {
      await recordBaselineObservation({
        startingMood: 2,
        hourOfDay: 9,
        dayOfWeek: 1,
        delta,
        source: "randomized",
      });
    }

    const baseline = await baselineFor({ startingMood: 2, hourOfDay: 9, dayOfWeek: 1 });

    expect(baseline.observations).toBe(2);
    expect(baseline.provisional).toBe(true);
    expect(baseline.delta).toBeGreaterThan(0);
    expect(baseline.delta).toBeLessThan(1);
  });

  it("weighs randomized evidence above observational", async () => {
    // Same cell, same magnitude, opposite signs, equal counts. If they were
    // pooled the result would be zero; randomized has to win.
    for (let i = 0; i < 20; i += 1) {
      await recordBaselineObservation({
        startingMood: 2, hourOfDay: 9, dayOfWeek: 1, delta: 1, source: "randomized",
      });
      await recordBaselineObservation({
        startingMood: 2, hourOfDay: 9, dayOfWeek: 1, delta: -1, source: "no_listen",
      });
    }

    const baseline = await baselineFor({ startingMood: 2, hourOfDay: 9, dayOfWeek: 1 });

    expect(baseline.delta).toBeGreaterThan(0);
    expect(baseline.sources.sort()).toEqual(["no_listen", "randomized"]);
    expect(baseline.provisional).toBe(false);
  });

  it("widens to any hour rather than giving up on an empty cell", async () => {
    for (let i = 0; i < 20; i += 1) {
      await recordBaselineObservation({
        startingMood: 2, hourOfDay: 3, dayOfWeek: 5, delta: 1, source: "randomized",
      });
    }

    // Nothing recorded at 14:00 on a Tuesday, but plenty for this mood.
    const baseline = await baselineFor({ startingMood: 2, hourOfDay: 14, dayOfWeek: 2 });

    expect(baseline.widened).toBe(true);
    expect(baseline.observations).toBe(20);
  });

  it("reports nothing rather than zero when it has no evidence", async () => {
    const baseline = await baselineFor({ startingMood: 4, hourOfDay: 1, dayOfWeek: 0 });

    expect(baseline.observations).toBe(0);
    expect(baseline.provisional).toBe(true);
    expect(baseline.sources).toEqual([]);
  });
});

describe("incremental lift", () => {
  it("subtracts what the day does from what the song appears to do", async () => {
    // A cell that reliably rises by 1 on its own.
    for (let i = 0; i < 40; i += 1) {
      await recordBaselineObservation({
        startingMood: 2, hourOfDay: 9, dayOfWeek: 1, delta: 1, source: "randomized",
      });
    }

    const { lift, baseline } = await liftOf({
      delta: 2,
      startingMood: 2,
      hourOfDay: 9,
      dayOfWeek: 1,
    });

    // Observed +2, but +1 of it was going to happen anyway.
    expect(baseline.delta).toBeGreaterThan(0.6);
    expect(lift).toBeLessThan(1.4);
    expect(lift).toBeGreaterThan(0);
  });

  it("equals the raw delta while no baseline exists", async () => {
    const { lift } = await liftOf({ delta: 2, startingMood: 2, hourOfDay: 9, dayOfWeek: 1 });

    // Honest default: with nothing to subtract, lift is the observation itself,
    // and the baseline it reports says it is provisional.
    expect(lift).toBe(2);
  });

  it("stores lift on the outcome when a session completes", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await startSession({ userId, sessionId, moodBefore: 2, timeZone: "UTC" });
    await completeSession({ userId, sessionId, moodAfter: 4, socketManager: null });

    const outcome = await SessionOutcome.findOne({ sessionId });
    expect(outcome.lift).not.toBeNull();
    expect(outcome.delta).toBe(2);
  });

  it("feeds a completed control session into the randomized baseline", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await recordImpressions({
      userId,
      sessionId,
      recommendations: [{ musicId: newId() }],
      arm: "control",
      startingMood: 2,
      timeZone: "UTC",
    });

    await startSession({ userId, sessionId, moodBefore: 2, timeZone: "UTC" });
    await completeSession({ userId, sessionId, moodAfter: 3, socketManager: null });

    const cells = await BaselineCell.find({ source: "randomized" });
    expect(cells).toHaveLength(1);
    expect(cells[0].observations).toBe(1);
    expect(cells[0].sumDelta).toBe(1);
  });

  it("does not let a policy session contaminate the baseline", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await recordImpressions({
      userId,
      sessionId,
      recommendations: [{ musicId: newId() }],
      arm: "policy",
      startingMood: 2,
      timeZone: "UTC",
    });

    await startSession({ userId, sessionId, moodBefore: 2, timeZone: "UTC" });
    await completeSession({ userId, sessionId, moodAfter: 5, socketManager: null });

    // The whole point: a session the policy chose cannot be its own control.
    expect(await BaselineCell.countDocuments({ source: "randomized" })).toBe(0);
  });
});

describe("the no-listen control group", () => {
  const checkInAt = (userId, intensity, minutesAgo) =>
    MoodEntry.create({
      userId,
      mood: intensity >= 3 ? "okay" : "low",
      intensity,
      source: "check-in",
      recordedAt: new Date(Date.now() - minutesAgo * 60 * 1000),
    });

  it("mines pairs of check-ins with nothing listened to between them", async () => {
    const userId = await consentingUser();
    await checkInAt(userId, 2, 180);
    await checkInAt(userId, 4, 60);

    const { pairs } = await rebuildNoListenBaseline();

    expect(pairs).toBe(1);
    const [cell] = await BaselineCell.find({ source: "no_listen" });
    expect(cell.sumDelta).toBe(2);
  });

  it("excludes a pair with a session in the window", async () => {
    const userId = await consentingUser();
    await checkInAt(userId, 2, 180);
    await checkInAt(userId, 4, 60);
    await SessionOutcome.create({
      userId,
      sessionId: newId(),
      moodBefore: 2,
      createdAt: new Date(Date.now() - 120 * 60 * 1000),
    });

    // Something was listened to, so this is not a no-listen pair.
    expect((await rebuildNoListenBaseline()).pairs).toBe(0);
  });

  it("ignores gaps that are too short or too long to compare", async () => {
    const userId = await consentingUser();
    await checkInAt(userId, 2, 601); // 10 hours — beyond the window
    await checkInAt(userId, 4, 120);
    await checkInAt(userId, 4, 119); // one minute later — too close

    expect((await rebuildNoListenBaseline()).pairs).toBe(0);
  });

  it("never pairs one person's check-in with another's", async () => {
    const first = await consentingUser();
    const second = await consentingUser();
    await checkInAt(first, 2, 180);
    await checkInAt(second, 5, 60);

    expect((await rebuildNoListenBaseline()).pairs).toBe(0);
  });

  it("is idempotent, so a nightly rebuild cannot double count", async () => {
    const userId = await consentingUser();
    await checkInAt(userId, 2, 180);
    await checkInAt(userId, 4, 60);

    await rebuildNoListenBaseline();
    await rebuildNoListenBaseline();

    const cells = await BaselineCell.find({ source: "no_listen" });
    expect(cells).toHaveLength(1);
    expect(cells[0].observations).toBe(1);
  });
});

describe("context is the user's, not the server's", () => {
  it("derives the hour and weekday in the user's zone", () => {
    // 23:00 UTC is 04:30 the next day in India.
    const at = new Date("2026-03-14T23:00:00.000Z");

    expect(contextOf(at, "UTC").hourOfDay).toBe(23);
    expect(contextOf(at, "Asia/Kolkata").hourOfDay).toBe(4);
    expect(contextOf(at, "UTC").dayOfWeek).not.toBe(
      contextOf(at, "Asia/Kolkata").dayOfWeek
    );
  });
});
