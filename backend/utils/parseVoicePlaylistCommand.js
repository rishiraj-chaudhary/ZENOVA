const MIN_PLAYLIST_NAME_LENGTH = 3;
const DEFAULT_PLAYLIST_NAME = "My Playlist";

/** Ordered most specific first: "playlist called X" beats "X playlist". */
const NAME_PATTERNS = [
  /(?:create|make)\s+(?:a\s+|an\s+)?(?:new\s+)?playlist\s+(?:called|named|for|titled)\s+(.+)/i,
  /(?:create|make)\s+(?:a\s+|an\s+)?(?:new\s+)?(.+?)\s+playlist/i,
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

const extractName = (command) => {
  for (const [index, pattern] of NAME_PATTERNS.entries()) {
    const match = command.match(pattern);
    if (!match) continue;

    // The second pattern captures the descriptor only ("workout"), so the word
    // "playlist" is restored to keep the name readable.
    const name = cleanName(index === 1 ? `${match[1]} playlist` : match[1]);
    if (name.length >= MIN_PLAYLIST_NAME_LENGTH) return name;
  }

  const fallback = cleanName(command);
  return fallback.length >= MIN_PLAYLIST_NAME_LENGTH ? fallback : DEFAULT_PLAYLIST_NAME;
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
