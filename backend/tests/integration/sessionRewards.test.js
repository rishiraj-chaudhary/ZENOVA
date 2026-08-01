import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { POINTS } from "../../config/gamification.js";
import Gamification from "../../models/Gamification.js";
import Recommendation from "../../models/Recommendation.js";
import User from "../../models/user.js";
import SessionOutcome from "../../models/SessionOutcome.js";
import {
  completeSession,
  markSessionListened,
  startSession,
} from "../../services/outcomeService.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const newId = () => new mongoose.Types.ObjectId();

/**
 * A real user who has consented to mood tracking. Sessions record self-reported
 * mood, so the write is gated on consent — a bare ObjectId is not enough.
 */
let userCounter = 0;
const consentingUser = async () => {
  userCounter += 1;
  const user = await User.create({
    name: `session-${userCounter}`,
    email: `session-${userCounter}-${Date.now()}@example.com`,
    password: "hunter2secure",
    consent: { moodTracking: true, grantedAt: new Date() },
  });
  return user._id;
};

/** A recommendation to hang a session off, as the real flow produces. */
const openSession = async (userId) => {
  const recommendation = await Recommendation.create({
    userId,
    detectedMood: "low",
    recommendedMusic: [{ musicId: newId(), reason: "test" }],
  });

  await startSession({
    userId,
    sessionId: recommendation._id,
    moodBefore: 2,
  });

  return recommendation._id;
};

const pointsOf = async (userId) =>
  (await Gamification.findOne({ userId }))?.totalPoints ?? 0;

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("rewarding a listening session", () => {
  it("pays for listening even when the after-rating never comes", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    // THERAPY_SESSION_COMPLETED existed in the reward table but nothing
    // awarded it, so listening without rating paid nothing at all.
    await markSessionListened({ userId, sessionId, socketManager: null });

    expect(await pointsOf(userId)).toBe(POINTS.THERAPY_SESSION_COMPLETED);
    expect((await SessionOutcome.findOne({ sessionId })).listenedAt).toBeTruthy();
  });

  it("pays once however many tracks are played", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await markSessionListened({ userId, sessionId, socketManager: null });
    await markSessionListened({ userId, sessionId, socketManager: null });
    await markSessionListened({ userId, sessionId, socketManager: null });

    expect(await pointsOf(userId)).toBe(POINTS.THERAPY_SESSION_COMPLETED);
  });

  it("pays the measurement bonus on top when the session is rated", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await markSessionListened({ userId, sessionId, socketManager: null });
    await completeSession({ userId, sessionId, moodAfter: 4, socketManager: null });

    // Listening is real use; measuring is what the effect ledger needs, and is
    // worth three times as much.
    expect(await pointsOf(userId)).toBe(
      POINTS.THERAPY_SESSION_COMPLETED + POINTS.SESSION_MEASURED
    );
  });

  it("counts listening and measuring separately", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await markSessionListened({ userId, sessionId, socketManager: null });
    await completeSession({ userId, sessionId, moodAfter: 4, socketManager: null });

    const stats = await Gamification.findOne({ userId });
    expect(stats.therapySessions).toBe(1);
    expect(stats.measuredSessions).toBe(1);
  });

  it("records nothing for a session that was never started", async () => {
    const userId = await consentingUser();

    const result = await markSessionListened({
      userId,
      sessionId: newId(),
      socketManager: null,
    });

    expect(result).toBeNull();
    expect(await pointsOf(userId)).toBe(0);
  });

  it("records nothing when another user claims the session", async () => {
    const owner = await consentingUser();
    const stranger = await consentingUser();
    const sessionId = await openSession(owner);

    const result = await markSessionListened({
      userId: stranger,
      sessionId,
      socketManager: null,
    });

    expect(result).toBeNull();
    expect(await pointsOf(stranger)).toBe(0);
  });

  it("pays once when several tracks start at the same moment", async () => {
    const userId = await consentingUser();
    const sessionId = await openSession(userId);

    await Promise.all(
      Array.from({ length: 5 }, () =>
        markSessionListened({ userId, sessionId, socketManager: null })
      )
    );

    // The listenedAt: null filter makes the transition a conditional update, so
    // only one of the racing calls claims it.
    expect(await pointsOf(userId)).toBe(POINTS.THERAPY_SESSION_COMPLETED);
  });
});
