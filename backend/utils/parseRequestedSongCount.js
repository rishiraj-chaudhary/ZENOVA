export const DEFAULT_SONG_COUNT = 5;
const MIN_SONG_COUNT = 1;
const MAX_SONG_COUNT = 15;

const WRITTEN_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const VAGUE_QUANTITIES = {
  couple: 2,
  few: 4,
  several: 6,
  many: 8,
  lots: 8,
};

const clamp = (count) =>
  Math.min(Math.max(count, MIN_SONG_COUNT), MAX_SONG_COUNT);

/** What the user might call a song, however they phrase the rest. */
const NOUNS = "songs?|tracks?|recommendations?|tunes?|pieces?";

/**
 * Up to three words may sit between the number and the noun, so "3 calming
 * songs" and "four sad piano tracks" are understood. Requiring them to be
 * adjacent meant any description of the music silently discarded the count and
 * the user got the default five instead of the three they asked for.
 */
const withGap = (quantity) =>
  new RegExp(`\\b${quantity}(?:\\s+[a-z-]+){0,3}\\s+(?:${NOUNS})\\b`);

/**
 * Infers how many songs the user asked for: "give me 3 calming tracks", "a few
 * songs", "seven songs". Falls back to DEFAULT_SONG_COUNT when nothing is said.
 */
const parseRequestedSongCount = (userInput = "") => {
  const normalized = userInput.toLowerCase();

  const digitMatch = normalized.match(withGap("(\\d+)"));
  if (digitMatch) return clamp(Number.parseInt(digitMatch[1], 10));

  for (const [word, count] of Object.entries(WRITTEN_NUMBERS)) {
    if (withGap(word).test(normalized)) return count;
  }

  // Word-bounded. A bare substring test read "Germany" as "many" and served
  // eight songs to someone who had only mentioned a country.
  for (const [word, count] of Object.entries(VAGUE_QUANTITIES)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) return count;
  }

  return DEFAULT_SONG_COUNT;
};

export default parseRequestedSongCount;
