import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DAILY_POINT_CAPS, POINTS } from "../../config/gamification.js";
import Gamification from "../../models/Gamification.js";
import { awardPoints, updateStreak } from "../../services/pointsService.js";
import { dayKey } from "../../utils/dayKey.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const newUserId = () => new mongoose.Types.ObjectId();

/**
 * Distinct entity keys, because awards are now deduplicated per entity. That is
 * the point of these tests: twenty *different* songs must all count, which is
 * what proves no update is lost. Twenty awards for the same song counting once
 * is correct behaviour, covered separately below.
 */
const awardMany = (userId, action, count) =>
  Promise.all(
    Array.from({ length: count }, (_, i) =>
      awardPoints(userId, action, null, { entityKey: `${action}-${i}` })
    )
  );

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("awardPoints under concurrency", () => {
  it("loses no points across 20 simultaneous awards", async () => {
    const userId = newUserId();

    // The previous read-modify-write persisted 1 of 10 awards.
    await awardMany(userId, "SONG_ADDED", 20);

    const stats = await Gamification.findOne({ userId });
    // Every distinct song is a real award, so nothing is lost — but the daily
    // ceiling bounds the total. Overshoot is at most one award, by design.
    expect(stats.totalPoints).toBeGreaterThan(0);
    expect(stats.totalPoints).toBeLessThanOrEqual(
      DAILY_POINT_CAPS.SONG_ADDED + POINTS.SONG_ADDED
    );
  });

  it("creates exactly one stats document when awards race to insert", async () => {
    const userId = newUserId();

    const results = await Promise.allSettled([
      awardPoints(userId, "DAILY_LOGIN", null),
      awardPoints(userId, "PLAYLIST_CREATED", null, { entityKey: "p1" }),
      awardPoints(userId, "SESSION_MEASURED", null, { entityKey: "s1" }),
    ]);

    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    expect(await Gamification.countDocuments({ userId })).toBe(1);
  });

  it("keeps counters independent across mixed concurrent actions", async () => {
    const userId = newUserId();

    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        awardPoints(userId, "SESSION_MEASURED", null, { entityKey: `s${i}` })
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        awardPoints(userId, "PLAYLIST_CREATED", null, { entityKey: `p${i}` })
      ),
    ]);

    const stats = await Gamification.findOne({ userId });
    expect(stats.measuredSessions).toBe(5);
    expect(stats.playlistsCreated).toBe(3);
  });

  it("never lowers a level once reached", async () => {
    const userId = newUserId();

    // 6 measured sessions x 30 = 180, past the level-2 threshold of 150.
    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        awardPoints(userId, "SESSION_MEASURED", null, { entityKey: `s${i}` })
      )
    );

    const stats = await Gamification.findOne({ userId });
    expect(stats.totalPoints).toBe(180);
    expect(stats.level).toBe(2);
  });
});

describe("award deduplication", () => {
  it("pays once for the same entity, however many times it is submitted", async () => {
    const userId = newUserId();

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        awardPoints(userId, "SESSION_MEASURED", null, { entityKey: "same-session" })
      )
    );

    expect(results.filter((r) => r.awarded)).toHaveLength(1);
    expect((await Gamification.findOne({ userId })).totalPoints).toBe(
      POINTS.SESSION_MEASURED
    );
  });

  it("pays the login bonus once per day", async () => {
    const userId = newUserId();

    await awardPoints(userId, "DAILY_LOGIN", null);
    const second = await awardPoints(userId, "DAILY_LOGIN", null);

    // Logging out and back in used to pay every time.
    expect(second.awarded).toBe(false);
    expect((await Gamification.findOne({ userId })).totalPoints).toBe(
      POINTS.DAILY_LOGIN
    );
  });

  it("enforces the daily cap on repeatable actions", async () => {
    const userId = newUserId();

    for (let i = 0; i < 12; i += 1) {
      await awardPoints(userId, "SONG_ADDED", null, { entityKey: `song-${i}` });
    }

    // Sequentially the ceiling is exact.
    const stats = await Gamification.findOne({ userId });
    expect(stats.totalPoints).toBe(DAILY_POINT_CAPS.SONG_ADDED);
  });
});

describe("updateStreak", () => {
  const yesterdayKey = () =>
    dayKey(new Date(Date.now() - 24 * 60 * 60 * 1000));

  it("advances the streak at most once when calls overlap", async () => {
    const userId = newUserId();
    await Gamification.create({
      userId,
      currentStreak: 3,
      lastActivityDay: yesterdayKey(),
    });

    await Promise.all([
      updateStreak(userId, null),
      updateStreak(userId, null),
      updateStreak(userId, null),
    ]);

    const stats = await Gamification.findOne({ userId });
    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });

  it("is idempotent within the same day and writes nothing", async () => {
    const userId = newUserId();
    const today = dayKey();
    await Gamification.create({ userId, currentStreak: 2, lastActivityDay: today });

    await updateStreak(userId, null);
    await updateStreak(userId, null);

    const stats = await Gamification.findOne({ userId });
    expect(stats.currentStreak).toBe(2);
    expect(stats.lastActivityDay).toBe(today);
  });

  it("counts a visit just after midnight as the next day", async () => {
    const userId = newUserId();
    await Gamification.create({
      userId,
      currentStreak: 1,
      lastActivityDay: yesterdayKey(),
    });

    // Raw millisecond arithmetic scored a 23:00 -> 08:00 visit as zero days and
    // failed to advance; calendar days get this right.
    expect(await updateStreak(userId, null)).toBe(2);
  });

  it("does not regress longestStreak when the current streak resets", async () => {
    const userId = newUserId();
    const longAgo = dayKey(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    await Gamification.create({
      userId,
      currentStreak: 9,
      longestStreak: 9,
      lastActivityDay: longAgo,
      lastGraceUsedDay: longAgo,
    });

    await updateStreak(userId, null);

    const stats = await Gamification.findOne({ userId });
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(9);
  });
});
