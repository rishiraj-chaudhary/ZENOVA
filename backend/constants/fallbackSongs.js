/**
 * Used when Gemini is unavailable or returns fewer songs than requested, so the
 * user always gets a usable therapeutic response instead of an error. Ordered
 * to span the emotional range: calming → supportive → energizing.
 */
const FALLBACK_SONGS = [
  {
    title: "Weightless",
    artist: "Marconi Union",
    genre: "Ambient",
    moodTags: ["calming", "relaxing", "therapeutic"],
    duration: 485,
    recommendedFor: ["relaxation", "stress relief"],
    reason:
      "This song was scientifically designed to reduce anxiety and promote relaxation.",
    energyLevel: "low",
    therapeuticFunction: "calm",
  },
  {
    title: "Clair de Lune",
    artist: "Claude Debussy",
    genre: "Classical",
    moodTags: ["peaceful", "contemplative", "soothing"],
    duration: 300,
    recommendedFor: ["meditation", "sleep preparation"],
    reason: "This classical piece promotes inner peace and emotional balance.",
    energyLevel: "low",
    therapeuticFunction: "support",
  },
  {
    title: "River",
    artist: "Leon Bridges",
    genre: "Soul",
    moodTags: ["hopeful", "uplifting", "spiritual"],
    duration: 245,
    recommendedFor: ["emotional healing", "hope building"],
    reason: "This soulful track provides comfort and hope during difficult times.",
    energyLevel: "medium",
    therapeuticFunction: "support",
  },
  {
    title: "Breathe",
    artist: "Telepopmusik",
    genre: "Electronic",
    moodTags: ["meditative", "centering", "peaceful"],
    duration: 275,
    recommendedFor: ["mindfulness", "anxiety relief"],
    reason:
      "The gentle electronic sounds help center the mind and reduce racing thoughts.",
    energyLevel: "low",
    therapeuticFunction: "calm",
  },
  {
    title: "Mad World",
    artist: "Gary Jules",
    genre: "Alternative",
    moodTags: ["melancholic", "reflective", "cathartic"],
    duration: 195,
    recommendedFor: ["emotional processing", "sadness validation"],
    reason:
      "Sometimes we need music that validates our difficult emotions before we can move forward.",
    energyLevel: "low",
    therapeuticFunction: "support",
  },
  {
    title: "Here Comes the Sun",
    artist: "The Beatles",
    genre: "Rock",
    moodTags: ["hopeful", "uplifting", "optimistic"],
    duration: 185,
    recommendedFor: ["mood lifting", "motivation"],
    reason:
      "This classic brings hope and reminds us that difficult times are temporary.",
    energyLevel: "medium",
    therapeuticFunction: "energize",
  },
  {
    title: "Lose Yourself",
    artist: "Eminem",
    genre: "Hip-Hop",
    moodTags: ["motivational", "empowering", "determined"],
    duration: 326,
    recommendedFor: ["motivation", "confidence building"],
    reason: "This powerful track helps build determination and self-confidence.",
    energyLevel: "high",
    therapeuticFunction: "motivate",
  },
  {
    title: "The Sound of Silence",
    artist: "Simon & Garfunkel",
    genre: "Folk",
    moodTags: ["reflective", "introspective", "contemplative"],
    duration: 200,
    recommendedFor: ["self-reflection", "processing emotions"],
    reason:
      "This song provides a safe space for deep reflection and emotional processing.",
    energyLevel: "low",
    therapeuticFunction: "support",
  },
];

export default FALLBACK_SONGS;
