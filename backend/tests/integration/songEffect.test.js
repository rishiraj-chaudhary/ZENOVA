import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import SongEffect from "../../models/SongEffect.js";
import {
  MIN_OBSERVATIONS,
  getEffectForSong,
  getLedgerCoverage,
  rankByMeasuredEffect,
  recordSessionEffect,
} from "../../services/songEffectService.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const songId = () => new mongoose.Types.ObjectId();

/** Records the same outcome n times, as n separate sessions would. */
const observe = async (id, { moodBefore, moodAfter, times = 1 }) => {
  for (let i = 0; i < times; i += 1) {
    await recordSessionEffect({ songIds: [id], moodBefore, moodAfter });
  }
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("recording measured effect", () => {
  it("accumulates running statistics per (song, starting state)", async () => {
    const id = songId();

    await observe(id, { moodBefore: 2, moodAfter: 4 });
    await observe(id, { moodBefore: 2, moodAfter: 3 });

    const cell = await SongEffect.findOne({ musicId: id, startingMood: 2 });
    expect(cell.observations).toBe(2);
    expect(cell.sumDelta).toBe(3);
    expect(cell.sumSquaredDelta).toBe(5);
    expect(cell.meanDelta).toBe(1.5);
  });

  it("keeps starting states separate", async () => {
    const id = songId();

    await observe(id, { moodBefore: 1, moodAfter: 4 });
    await observe(id, { moodBefore: 5, moodAfter: 5 });

    // Effect is conditional on where you began — a song that lifts someone from
    // awful says nothing about someone already fine.
    expect((await SongEffect.findOne({ musicId: id, startingMood: 1 })).meanDelta).toBe(3);
    expect((await SongEffect.findOne({ musicId: id, startingMood: 5 })).meanDelta).toBe(0);
  });

  it("credits every song in the session", async () => {
    const [a, b] = [songId(), songId()];

    await recordSessionEffect({ songIds: [a, b], moodBefore: 2, moodAfter: 4 });

    expect(await SongEffect.countDocuments({})).toBe(2);
  });

  it("loses nothing when sessions complete concurrently", async () => {
    const id = songId();

    await Promise.all(
      Array.from({ length: 15 }, () =>
        recordSessionEffect({ songIds: [id], moodBefore: 3, moodAfter: 4 })
      )
    );

    const cell = await SongEffect.findOne({ musicId: id, startingMood: 3 });
    expect(cell.observations).toBe(15);
  });

  it("ignores an incomplete session", async () => {
    await recordSessionEffect({ songIds: [songId()], moodBefore: 3, moodAfter: null });
    await recordSessionEffect({ songIds: [], moodBefore: 3, moodAfter: 4 });

    expect(await SongEffect.countDocuments({})).toBe(0);
  });
});

describe("ranking by measured effect", () => {
  it("prefers well-evidenced modest lift over thin large lift", async () => {
    const thin = songId();
    const solid = songId();

    await observe(thin, { moodBefore: 2, moodAfter: 5, times: 5 });   // +3.0, n=5
    await observe(solid, { moodBefore: 2, moodAfter: 3, times: 60 }); // +1.0, n=60

    const ranked = await rankByMeasuredEffect(2);

    // Ranked on the lower confidence bound, so a mean from five observations
    // cannot outrank one from sixty.
    expect(ranked[0].musicId.toString()).toBe(solid.toString());
    expect(ranked[0].evidence).toBe("established");
  });

  it("excludes songs that did not help", async () => {
    const helps = songId();
    const harms = songId();

    await observe(helps, { moodBefore: 2, moodAfter: 4, times: 30 });
    await observe(harms, { moodBefore: 2, moodAfter: 1, times: 30 });

    const ranked = await rankByMeasuredEffect(2);
    expect(ranked.map((r) => r.musicId.toString())).not.toContain(harms.toString());
  });

  it("returns nothing below the evidence floor", async () => {
    await observe(songId(), { moodBefore: 2, moodAfter: 5, times: 3 });

    // Three observations is an anecdote. Surfacing it as "measured to help"
    // would be exactly the unearned confidence the product disclaims.
    expect(await rankByMeasuredEffect(2)).toEqual([]);
  });

  it("labels evidence strength honestly", async () => {
    const id = songId();
    await observe(id, { moodBefore: 3, moodAfter: 4, times: 6 });

    const [entry] = await rankByMeasuredEffect(3);
    expect(entry.evidence).toBe("provisional");
    expect(entry.observations).toBeLessThan(MIN_OBSERVATIONS);
  });

  it("reports a confidence interval, not just a mean", async () => {
    const id = songId();
    await observe(id, { moodBefore: 2, moodAfter: 4, times: 25 });

    const effect = await getEffectForSong(id, 2);
    expect(effect.meanDelta).toBe(2);
    expect(effect.confidenceLow).toBeLessThanOrEqual(effect.meanDelta);
    expect(effect.confidenceHigh).toBeGreaterThanOrEqual(effect.meanDelta);
  });
});

describe("ledger coverage", () => {
  it("reports how much evidence exists", async () => {
    await observe(songId(), { moodBefore: 2, moodAfter: 4, times: 25 });
    await observe(songId(), { moodBefore: 2, moodAfter: 3, times: 2 });

    const coverage = await getLedgerCoverage();
    expect(coverage.cells).toBe(2);
    expect(coverage.observations).toBe(27);
    expect(coverage.establishedCells).toBe(1);
  });

  it("starts empty", async () => {
    expect(await getLedgerCoverage()).toEqual({
      cells: 0,
      observations: 0,
      establishedCells: 0,
    });
  });
});
