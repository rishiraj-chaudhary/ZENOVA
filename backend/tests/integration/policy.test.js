import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import ListeningEvent from "../../models/ListeningEvent.js";
import SongEffect from "../../models/SongEffect.js";
import {
  findHarmfulSongs,
  posteriorOf,
  rankWithExploration,
  sampleRanking,
} from "../../services/banditService.js";
import {
  canDecide,
  doublyRobustScore,
  evaluatePolicy,
  inversePropensityScore,
  selfNormalisedScore,
} from "../../services/opeService.js";
import {
  DEFAULT_TEMPERATURE,
  MAX_TEMPERATURE,
  MIN_TEMPERATURE,
  derivePersona,
  distributionDistance,
  explorationTemperature,
  normalisedEntropy,
} from "../../services/personaService.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const newId = () => new mongoose.Types.ObjectId();

/** Deterministic "randomness", so a sampling test is not a coin flip. */
const fixedRandom = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

const cell = (musicId, { observations, sumDelta, sumSquaredDelta }) => ({
  musicId,
  observations,
  sumDelta,
  sumSquaredDelta,
});

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("entropy sets how adventurous recommendations are", () => {
  it("is zero for one repeated item and one for an even spread", () => {
    expect(normalisedEntropy({ lofi: 50 })).toBe(0);
    expect(normalisedEntropy({ a: 10, b: 10, c: 10, d: 10 })).toBeCloseTo(1, 5);
  });

  it("ranks a narrow listener below a wide one", () => {
    const narrow = normalisedEntropy({ lofi: 90, ambient: 5, jazz: 5 });
    const wide = normalisedEntropy({ lofi: 20, ambient: 20, jazz: 20, rock: 20, pop: 20 });

    expect(narrow).toBeLessThan(wide);
  });

  it("gives concentrated taste a low temperature and wide taste a high one", () => {
    const narrow = explorationTemperature({ entropy: 0.05, sampleSize: 500 });
    const wide = explorationTemperature({ entropy: 0.95, sampleSize: 500 });

    // The coherence argument: persona parameterises the policy rather than
    // decorating a prompt.
    expect(narrow).toBeLessThan(DEFAULT_TEMPERATURE);
    expect(wide).toBeGreaterThan(DEFAULT_TEMPERATURE);
    expect(narrow).toBeGreaterThanOrEqual(MIN_TEMPERATURE);
    expect(wide).toBeLessThanOrEqual(MAX_TEMPERATURE);
  });

  it("does not let a thin profile drive a strong decision", () => {
    // Same extreme entropy, four plays behind it.
    const thin = explorationTemperature({ entropy: 0.95, sampleSize: 4 });
    const solid = explorationTemperature({ entropy: 0.95, sampleSize: 500 });

    expect(Math.abs(thin - DEFAULT_TEMPERATURE)).toBeLessThan(
      Math.abs(solid - DEFAULT_TEMPERATURE)
    );
  });

  it("sits in the middle with no persona at all", () => {
    expect(explorationTemperature(null)).toBe(DEFAULT_TEMPERATURE);
  });

  it("measures how far recent taste has moved", () => {
    expect(distributionDistance({ a: 1 }, { a: 1 })).toBe(0);
    expect(distributionDistance({ a: 1 }, { b: 1 })).toBe(1);
    expect(distributionDistance({ a: 0.5, b: 0.5 }, { a: 1 })).toBeCloseTo(0.5, 5);
  });

  it("derives a persona from accumulated listening", async () => {
    const userId = newId();

    for (let i = 0; i < 12; i += 1) {
      await ListeningEvent.create({
        userId,
        spotifyTrackId: `track-${i}`,
        artist: i < 9 ? "Narrow Favourite" : `Other ${i}`,
        genres: i < 9 ? ["lo-fi"] : ["jazz"],
        popularity: 40,
        releaseYear: 2015,
        playedAt: new Date(Date.now() - i * 3600 * 1000),
        hourOfDay: 23,
      });
    }

    const persona = await derivePersona(userId);

    expect(persona.sampleSize).toBe(12);
    expect(persona.topGenres[0]).toBe("lo-fi");
    // Concentrated listening, so a low temperature.
    expect(persona.entropy).toBeLessThan(0.7);
    expect(persona.circadian[23]).toBe(12);
  });
});

describe("Thompson sampling explores what it does not know", () => {
  it("widens the posterior when observations are few", () => {
    const thin = posteriorOf(cell(newId(), { observations: 2, sumDelta: 4, sumSquaredDelta: 8 }));
    const thick = posteriorOf(
      cell(newId(), { observations: 80, sumDelta: 80, sumSquaredDelta: 120 })
    );

    expect(thin.standardDeviation).toBeGreaterThan(thick.standardDeviation);
  });

  it("does not claim certainty from zero variance", () => {
    // Five identical +3 ratings: no measured variance at all, which is exactly
    // where a naive confidence bound collapses and thin evidence wins.
    const posterior = posteriorOf(
      cell(newId(), { observations: 5, sumDelta: 15, sumSquaredDelta: 45 })
    );

    expect(posterior.standardDeviation).toBeGreaterThan(0.1);
  });

  it("returns a propensity for every served candidate", () => {
    const cells = [
      cell(newId(), { observations: 40, sumDelta: 40, sumSquaredDelta: 60 }),
      cell(newId(), { observations: 3, sumDelta: 6, sumSquaredDelta: 14 }),
      cell(newId(), { observations: 20, sumDelta: 10, sumSquaredDelta: 20 }),
    ];

    const ranked = sampleRanking(cells, { limit: 2 });

    expect(ranked).toHaveLength(2);
    for (const entry of ranked) {
      expect(entry.propensity).toBeGreaterThan(0);
      expect(entry.propensity).toBeLessThanOrEqual(1);
    }
  });

  it("labels a barely-observed pick as exploring, not as evidence", () => {
    const ranked = sampleRanking(
      [cell(newId(), { observations: 2, sumDelta: 4, sumSquaredDelta: 8 })],
      { limit: 1 }
    );

    expect(ranked[0].evidence).toBe("exploring");
  });

  it("lets a well-established song win at low temperature", () => {
    const strong = newId();
    const weak = newId();
    const cells = [
      cell(strong, { observations: 100, sumDelta: 150, sumSquaredDelta: 260 }),
      cell(weak, { observations: 2, sumDelta: 1, sumSquaredDelta: 3 }),
    ];

    // Temperature near zero collapses sampling to the posterior means.
    const ranked = sampleRanking(cells, {
      temperature: 0.001,
      limit: 1,
      random: fixedRandom([0.5, 0.5]),
    });

    expect(ranked[0].musicId).toBe(strong);
  });

  it("returns nothing rather than inventing a ranking from no data", () => {
    expect(sampleRanking([], {})).toEqual([]);
  });
});

describe("the negative-effect guardrail", () => {
  const seedEffect = (musicId, startingMood, deltas) =>
    SongEffect.create({
      musicId,
      startingMood,
      observations: deltas.length,
      sumDelta: deltas.reduce((sum, d) => sum + d, 0),
      sumSquaredDelta: deltas.reduce((sum, d) => sum + d * d, 0),
    });

  it("finds a song that reliably leaves people worse", async () => {
    const harmful = newId();
    await seedEffect(harmful, 2, Array.from({ length: 30 }, () => -1.5));

    const found = await findHarmfulSongs(2);

    // The rumination trap: music that matches a low mood and keeps someone
    // there. An engagement-optimised recommender would surface exactly this.
    expect(found.map((entry) => entry.musicId.toString())).toContain(harmful.toString());
  });

  it("does not condemn a song on one bad run", async () => {
    await seedEffect(newId(), 2, [-2, 1, 1]);

    expect(await findHarmfulSongs(2)).toEqual([]);
  });

  it("leaves a helpful song alone", async () => {
    await seedEffect(newId(), 2, Array.from({ length: 30 }, () => 1.5));

    expect(await findHarmfulSongs(2)).toEqual([]);
  });

  it("suppresses harmful songs from what gets served", async () => {
    const harmful = newId();
    const helpful = newId();
    await seedEffect(harmful, 2, Array.from({ length: 30 }, () => -1.5));
    await seedEffect(helpful, 2, Array.from({ length: 30 }, () => 1.2));

    const { ranked, suppressed } = await rankWithExploration(2, { limit: 5 });

    expect(suppressed).toHaveLength(1);
    expect(ranked.map((entry) => entry.musicId.toString())).not.toContain(
      harmful.toString()
    );
  });
});

describe("off-policy evaluation", () => {
  const sample = (reward, propensity, targetProbability) => ({
    reward,
    propensity,
    targetProbability,
  });

  it("recovers the mean when the policies agree", () => {
    const samples = [sample(2, 0.5, 0.5), sample(0, 0.5, 0.5)];

    expect(inversePropensityScore(samples)).toBeCloseTo(1, 5);
    expect(selfNormalisedScore(samples)).toBeCloseTo(1, 5);
  });

  it("rewards a policy that favours what worked", () => {
    // The target policy puts more weight on the impression that went well.
    const samples = [sample(2, 0.5, 0.9), sample(0, 0.5, 0.1)];

    expect(selfNormalisedScore(samples)).toBeGreaterThan(1);
  });

  it("penalises a policy that favours what did not work", () => {
    const samples = [sample(2, 0.5, 0.1), sample(0, 0.5, 0.9)];

    expect(selfNormalisedScore(samples)).toBeLessThan(1);
  });

  it("clips a runaway weight so one lucky impression cannot decide it", () => {
    // Served with probability 0.001; unclipped this weight would be 1000.
    const samples = [sample(5, 0.001, 1), sample(0, 0.5, 0.5)];

    expect(inversePropensityScore(samples)).toBeLessThan(60);
  });

  it("stays consistent when the reward model is right and propensities are not", () => {
    const samples = [sample(2, 0.9, 0.1), sample(2, 0.9, 0.1)];

    // Doubly robust: right if *either* component is right, which is why it is
    // the estimator worth gating on.
    expect(doublyRobustScore(samples, () => 2)).toBeCloseTo(2, 5);
  });

  it("reports effective sample size, not just the raw count", async () => {
    const samples = [
      { reward: 1, propensity: 0.5, position: 0, context: {} },
      { reward: 1, propensity: 0.5, position: 1, context: {} },
      { reward: 1, propensity: 0.5, position: 2, context: {} },
    ];

    // A target policy that disagrees sharply concentrates all the weight on one
    // impression, and the estimate is worth far less than "3 samples" suggests.
    const lopsided = await evaluatePolicy({
      samples,
      targetPolicy: (s) => (s.position === 0 ? 1 : 0.001),
    });

    expect(lopsided.samples).toBe(3);
    expect(lopsided.effectiveSampleSize).toBeLessThan(2);
    expect(canDecide(lopsided)).toBe(false);
  });

  it("says nothing rather than guessing with no data", async () => {
    const result = await evaluatePolicy({ samples: [], targetPolicy: () => 1 });

    expect(result.samples).toBe(0);
    expect(result.ips).toBeNull();
    expect(canDecide(result)).toBe(false);
  });
});
