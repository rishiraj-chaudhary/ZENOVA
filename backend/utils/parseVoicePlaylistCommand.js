const MIN_PLAYLIST_NAME_LENGTH = 3;
const DEFAULT_PLAYLIST_NAME = "My Playlist";

/**
 * An optional indirect object — "make *me* a playlist", "build *us* one" — which
 * every real phrasing has and neither pattern allowed. Without it the second
 * pattern captured the pronoun as the descriptor, so "make me a playlist for
 * studying" produced a playlist named "me a playlist".
 */
const LEAD_IN = "(?:create|make|build|start)\\s+(?:me\\s+|us\\s+)?(?:a\\s+|an\\s+)?(?:new\\s+)?";

/** Ordered most specific first: "playlist called X" beats "X playlist". */
const NAME_PATTERNS = [
  new RegExp(`${LEAD_IN}playlist\\s+(?:called|named|titled|for|about)\\s+(.+)`, "i"),
  new RegExp(`${LEAD_IN}(.+?)\\s+playlist`, "i"),
];

const PLAYLIST_TYPE_KEYWORDS = {
  workout: ["workout", "exercise", "fitness", "gym"],
  relaxation: ["relax", "calm", "chill", "meditation", "sleep"],
  focus: ["focus", "study", "concentration", "work"],
  party: ["party", "celebration", "dance"],
  travel: ["travel", "road trip", "journey", "vacation"],
  mood: ["happy", "sad", "energetic", "motivated"],
};

const cleanName = (name) => name.replace(/[.!?]+$/, "").trim();

/** Leftovers from the command itself, never a name the user chose. */
const FILLER_NAMES = new Set(["a", "an", "the", "a playlist", "one", "me", "us"]);

const extractName = (command) => {
  for (const [index, pattern] of NAME_PATTERNS.entries()) {
    const match = command.match(pattern);
    if (!match) continue;

    // The second pattern captures the descriptor only ("workout"), so the word
    // "playlist" is restored to keep the name readable.
    const name = cleanName(index === 1 ? `${match[1]} playlist` : match[1]);
    if (name.length >= MIN_PLAYLIST_NAME_LENGTH && !FILLER_NAMES.has(name.toLowerCase())) {
      return name;
    }
  }

  // Nothing matched, so use whatever is left once the command words are gone.
  // Returning the raw command named playlists things like "make a playlist".
  const fallback = cleanName(
    command
      .replace(new RegExp(LEAD_IN, "i"), "")
      .replace(/\bplaylists?\b/gi, "")
      .trim()
  );

  return fallback.length >= MIN_PLAYLIST_NAME_LENGTH && !FILLER_NAMES.has(fallback.toLowerCase())
    ? fallback
    : DEFAULT_PLAYLIST_NAME;
};

const detectType = (command) => {
  const normalized = command.toLowerCase();
  const match = Object.entries(PLAYLIST_TYPE_KEYWORDS).find(([, keywords]) =>
    keywords.some((keyword) => normalized.includes(keyword))
  );
  return match?.[0] ?? null;
};

/** Turns "make me a chill study playlist" into { name, type }. */
const parseVoicePlaylistCommand = (command) => ({
  name: extractName(command),
  type: detectType(command),
});

export default parseVoicePlaylistCommand;
