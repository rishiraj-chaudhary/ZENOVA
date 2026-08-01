import axios from "axios";
import logger from "../utils/logger.js";

const SEARCH_ENDPOINT = "https://itunes.apple.com/search";
const REQUEST_TIMEOUT_MS = 6000;

/**
 * iTunes is unauthenticated but rate-limited (roughly 20 requests a minute from
 * one address). Recommendation requests resolve a handful of songs at a time,
 * so a short in-process cache and a bounded lookup are enough; the backfill
 * script paces itself separately.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_LIMIT = 500;
const cache = new Map();

const cacheKey = (title, artist) => `${title}::${artist}`.toLowerCase();

const readCache = (key) => {
  const hit = cache.get(key);
  if (!hit) return undefined;

  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
};

const writeCache = (key, value) => {
  // Oldest-first eviction, so a long-running process cannot grow without bound.
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * The first credited artist.
 *
 * Songs are stored with their full credit list — "A.R. Rahman, Javed Ali, Mohit
 * Chauhan" — and searching for all of it verbatim returns nothing, which lost
 * most of the Bollywood catalogue. iTunes indexes the primary artist.
 */
const primaryArtist = (artist = "") => artist.split(/,|&|feat\.|ft\./i)[0].trim();

const normalize = (text = "") =>
  text
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

/**
 * Both the title and the artist have to match, or a search for an obscure song
 * happily returns a preview of something else entirely — worse than no preview,
 * because the user hears the wrong track and blames the recommendation.
 */
const matches = (result, title, artist) => {
  const wantedTitle = normalize(title);
  // Matched against the full credit list, so a result crediting any one of the
  // artists still counts.
  const wantedArtist = normalize(artist);
  const foundTitle = normalize(result.trackName);
  const foundArtist = normalize(result.artistName);

  const titleMatches =
    foundTitle.includes(wantedTitle) || wantedTitle.includes(foundTitle);
  const artistMatches =
    foundArtist.includes(wantedArtist) || wantedArtist.includes(foundArtist);

  return titleMatches && artistMatches && Boolean(result.previewUrl);
};

/**
 * Finds a 30-second preview for a song.
 *
 * Spotify stopped returning `preview_url` for most tracks, which left every one
 * of the 946 songs in this catalogue with a null preview and the player's
 * `<audio>` control rendering nothing at all. iTunes Search still publishes
 * previews, needs no key, and covers the same mainstream catalogue.
 *
 * Returns null rather than throwing: a missing preview is a missing nicety, and
 * must never fail the recommendation it was attached to.
 */
export const findPreviewUrl = async (title, artist) => {
  if (!title || !artist) return null;

  const key = cacheKey(title, artist);
  const cached = readCache(key);
  if (cached !== undefined) return cached;

  try {
    const { data } = await axios.get(SEARCH_ENDPOINT, {
      params: {
        term: `${title} ${primaryArtist(artist)}`,
        entity: "song",
        limit: 10,
      },
      timeout: REQUEST_TIMEOUT_MS,
    });

    const match = (data.results ?? []).find((result) =>
      matches(result, title, artist)
    );
    const previewUrl = match?.previewUrl ?? null;

    writeCache(key, previewUrl);
    return previewUrl;
  } catch (error) {
    logger.debug("preview lookup failed", { title, detail: error.message });
    // Not cached: a timeout is transient and the next request should retry.
    return null;
  }
};

export default findPreviewUrl;
