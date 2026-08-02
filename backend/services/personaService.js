import ListeningEvent from "../models/ListeningEvent.js";
import SpotifyPersona from "../models/SpotifyPersona.js";
import logger from "../utils/logger.js";

/**
 * Deriving a taste profile, and using it to set how adventurous the recommender
 * should be.
 *
 * The entropy term is the piece that makes persona more than prompt decoration:
 * someone whose listening is concentrated in three genres should not be pushed
 * into unfamiliar territory, and someone who listens to everything should be.
 * That is a decision-policy parameter, not a description.
 */

/** Normalised Shannon entropy: 0 is one repeated item, 1 is perfectly even. */
export const normalisedEntropy = (counts) => {
  const values = Object.values(counts).filter((count) => count > 0);
  if (values.length <= 1) return 0;

  const total = values.reduce((sum, count) => sum + count, 0);
  const entropy = -values.reduce((sum, count) => {
    const p = count / total;
    return sum + p * Math.log2(p);
  }, 0);

  return entropy / Math.log2(values.length);
};

/** How far two weighted distributions have moved apart, 0 to 1. */
export const distributionDistance = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  if (keys.size === 0) return 0;

  let distance = 0;
  for (const key of keys) distance += Math.abs((a[key] ?? 0) - (b[key] ?? 0));

  // Total variation distance: half the L1 distance between two distributions.
  return Math.min(distance / 2, 1);
};

const normalise = (counts) => {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  if (total === 0) return {};

  return Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, value / total])
  );
};

/**
 * Rank-weighted counts.
 *
 * Position matters: a user's top artist is not merely one play more important
 * than their fiftieth, so weight decays with rank rather than counting flat.
 */
const rankWeighted = (items, keyFn) => {
  const counts = {};

  items.forEach((item, index) => {
    const weight = 1 / Math.log2(index + 2);
    for (const key of [keyFn(item)].flat().filter(Boolean)) {
      counts[key] = (counts[key] ?? 0) + weight;
    }
  });

  return counts;
};

/**
 * Builds the profile from whatever history exists.
 *
 * Works from the accumulated ListeningEvent stream, so it improves as the
 * poller runs rather than depending on a single API call.
 */
export const derivePersona = async (userId, { shortTermDays = 21 } = {}) => {
  const events = await ListeningEvent.find({ userId })
    .sort({ playedAt: -1 })
    .limit(1000)
    .lean();

  if (events.length === 0) return null;

  const since = new Date(Date.now() - shortTermDays * 24 * 60 * 60 * 1000);
  const recent = events.filter((event) => new Date(event.playedAt) >= since);
  const older = events.filter((event) => new Date(event.playedAt) < since);

  const genreCounts = rankWeighted(events, (event) => event.genres);
  const artistCounts = rankWeighted(events, (event) => event.artist);

  const circadian = new Array(24).fill(0);
  for (const event of events) {
    if (Number.isInteger(event.hourOfDay)) circadian[event.hourOfDay] += 1;
  }

  const popularities = events
    .map((event) => event.popularity)
    .filter((value) => Number.isFinite(value));
  const years = events
    .map((event) => event.releaseYear)
    .filter((value) => Number.isFinite(value));

  const currentYear = new Date().getUTCFullYear();

  const persona = {
    genreVector: normalise(genreCounts),
    // Entropy over both axes: someone can range widely within one genre, or
    // narrowly across several, and both count as adventurousness.
    entropy: (normalisedEntropy(genreCounts) + normalisedEntropy(artistCounts)) / 2,
    tasteDrift:
      recent.length >= 10 && older.length >= 10
        ? distributionDistance(
            normalise(rankWeighted(recent, (e) => e.genres)),
            normalise(rankWeighted(older, (e) => e.genres))
          )
        : null,
    mainstreamIndex: popularities.length
      ? popularities.reduce((sum, value) => sum + value, 0) / popularities.length / 100
      : null,
    nostalgiaIndex: years.length
      ? Math.min(
          years.reduce((sum, year) => sum + (currentYear - year), 0) / years.length / 40,
          1
        )
      : null,
    circadian,
    topArtists: Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([artist]) => artist),
    topGenres: Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([genre]) => genre),
    sampleSize: events.length,
    refreshedAt: new Date(),
  };

  await SpotifyPersona.findOneAndUpdate({ userId }, persona, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  });

  logger.info("persona derived", { sampleSize: events.length, entropy: persona.entropy });
  return persona;
};

export const getPersona = (userId) => SpotifyPersona.findOne({ userId }).lean();

/**
 * How adventurous this user's recommendations should be.
 *
 * Concentrated taste gets a low temperature — respect a narrow preference
 * rather than fighting it. Wide-ranging taste gets aggressive exploration,
 * because for them an unfamiliar suggestion is the product working. Without a
 * persona, sit in the middle.
 */
export const MIN_TEMPERATURE = 0.15;
export const MAX_TEMPERATURE = 0.9;
export const DEFAULT_TEMPERATURE = 0.4;

export const explorationTemperature = (persona) => {
  if (!persona || persona.entropy == null) return DEFAULT_TEMPERATURE;

  // A profile built on a handful of plays should not drive a strong decision
  // either way, so pull it toward the default until there is enough history.
  const confidence = Math.min((persona.sampleSize ?? 0) / 200, 1);
  const fromEntropy =
    MIN_TEMPERATURE + persona.entropy * (MAX_TEMPERATURE - MIN_TEMPERATURE);

  return DEFAULT_TEMPERATURE + confidence * (fromEntropy - DEFAULT_TEMPERATURE);
};

/** The circadian trough: the hour this person listens most, as a proxy. */
export const peakListeningHour = (persona) => {
  if (!persona?.circadian?.length) return null;

  const peak = persona.circadian.reduce(
    (best, count, hour) => (count > persona.circadian[best] ? hour : best),
    0
  );

  return persona.circadian[peak] > 0 ? peak : null;
};
