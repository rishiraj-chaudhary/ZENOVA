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

/**
 * Infers how many songs the user asked for: "give me 3 tracks", "a few songs",
 * "seven songs". Falls back to DEFAULT_SONG_COUNT when nothing is stated.
 */
const parseRequestedSongCount = (userInput = "") => {
  const normalized = userInput.toLowerCase();

  const digitMatch = normalized.match(
    /(\d+)\s*(?:songs?|tracks?|recommendations?)/
  );
  if (digitMatch) return clamp(Number.parseInt(digitMatch[1], 10));

  for (const [word, count] of Object.entries(WRITTEN_NUMBERS)) {
    if (new RegExp(`\\b${word}\\s+(?:songs?|tracks?)`).test(normalized)) {
      return count;
    }
  }

  for (const [word, count] of Object.entries(VAGUE_QUANTITIES)) {
    if (normalized.includes(word)) return count;
  }

  return DEFAULT_SONG_COUNT;
};

export default parseRequestedSongCount;
