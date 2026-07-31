/**
 * Accent colours per detected mood.
 *
 * Used for borders, icons and small fills only — never as a text background.
 * Several of these (gold, cyan) fail contrast against white text, which is why
 * the recommendation card renders on a fixed dark surface and uses these
 * decoratively.
 */
const MOOD_COLORS = {
  happy: { primary: "#FFD700", secondary: "#FFA500", accent: "#FF6B6B" },
  sad: { primary: "#3498DB", secondary: "#2980B9", accent: "#1ABC9C" },
  angry: { primary: "#E74C3C", secondary: "#C0392B", accent: "#F39C12" },
  calm: { primary: "#2ECC71", secondary: "#27AE60", accent: "#3498DB" },
  anxious: { primary: "#9B59B6", secondary: "#8E44AD", accent: "#3498DB" },
  stressed: { primary: "#1ABC9C", secondary: "#16A085", accent: "#3498DB" },
  default: { primary: "#6366f1", secondary: "#4f46e5", accent: "#1DB954" },
};

export const colorsForMood = (mood) =>
  MOOD_COLORS[mood?.toLowerCase()] ?? MOOD_COLORS.default;

export default MOOD_COLORS;
