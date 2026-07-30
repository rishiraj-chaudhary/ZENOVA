import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import Gamification from "../../models/Gamification.js";
import { awardPoints, updateStreak } from "../../services/pointsService.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const SONG_ADDED_POINTS = 5;
const newUserId = () => new mongoose.Types.ObjectId();

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("awardPoints under concurrency", () => {
  it("loses no points across 20 simultaneous awards", async () => {
    const userId = newUserId();

    // The previous read-modify-write persisted 1 of 10 awards. A plain `await`
    // loop would pass against that implementation, so the awards must overlap.
    const awards = Array.from({ length: 20 }, () =>
      awardPoints(userId, "SONG_ADDED", null)
    );
    const results = await Promise.allSettled(awards);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const stats = await Gamification.findOne({ userId });
    expect(stats.totalPoints).toBe(20 * SONG_ADDED_POINTS);
    expect(stats.songsAdded).toBe(20);
  });

  it("creates exactly one stats document when awards race to insert", async () => {
    const userId = newUserId();

    const results = await Promise.allSettled([
      awardPoints(userId, "DAILY_LOGIN", null),
      awardPoints(userId, "PLAYLIST_CREATED", null),
      awardPoints(userId, "SONG_ADDED", null),
    ]);

    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected.map((r) => r.reason?.message)).toEqual([]);
    expect(await Gamification.countDocuments({ userId })).toBe(1);
  });

  it("keeps counters independent across mixed concurrent actions", async () => {
    const userId = newUserId();

    await Promise.all([
      ...Array.from({ length: 5 }, () => awardPoints(userId, "SONG_ADDED", null)),
      ...Array.from({ length: 3 }, () => awardPoints(userId, "PLAYLIST_CREATED", null)),
    ]);

    const stats = await Gamification.findOne({ userId });
    expect(stats.songsAdded).toBe(5);
    expect(stats.playlistsCreated).toBe(3);
  });

  it("never lowers a level once reached", async () => {
    const userId = newUserId();

    // 10 awards × 5 points = 50, which crosses the level-2 threshold of 40.
    await Promise.all(
      Array.from({ length: 10 }, () => awardPoints(userId, "SONG_ADDED", null))
    );

    const stats = await Gamification.findOne({ userId });
    expect(stats.totalPoints).toBe(50);
    expect(stats.level).toBe(2);
  });
});

describe("updateStreak under concurrency", () => {
  it("advances the streak at most once when calls overlap", async () => {
    const userId = newUserId();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    await Gamification.create({ userId, currentStreak: 3, lastActivity: yesterday });

    await Promise.all([
      updateStreak(userId, null),
      updateStreak(userId, null),
      updateStreak(userId, null),
    ]);

    const stats = await Gamification.findOne({ userId });
    // 3 -> 4, not 3 -> 6. The guarded write drops the losers.
    expect(stats.currentStreak).toBe(4);
    expect(stats.longestStreak).toBe(4);
  });

  it("is idempotent within the same day", async () => {
    const userId = newUserId();
    await Gamification.create({ userId, currentStreak: 2, lastActivity: new Date() });

    await updateStreak(userId, null);
    await updateStreak(userId, null);

    const stats = await Gamification.findOne({ userId });
    expect(stats.currentStreak).toBe(2);
  });

  it("does not regress longestStreak when the current streak resets", async () => {
    const userId = newUserId();
    const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await Gamification.create({
      userId,
      currentStreak: 9,
      longestStreak: 9,
      lastActivity: longAgo,
      lastGraceUsedAt: longAgo,
    });

    await updateStreak(userId, null);

    const stats = await Gamification.findOne({ userId });
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(9);
  });
});
