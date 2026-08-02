import mongoose from "mongoose";

/**
 * A musical taste profile, derived from real listening history.
 *
 * Framed as taste, never as personality. The preference-to-personality
 * correlations in the literature are real but modest — nowhere near strong
 * enough to tell someone what kind of person they are, and claiming it falls
 * apart under one informed question. A well-constructed taste prior used for
 * cold start is accurate, defensible, and more useful.
 */
const spotifyPersonaSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },

  /** Rank-weighted genre affinities, summing to 1. */
  genreVector: { type: Map, of: Number, default: {} },

  /** How far short-term listening has moved from long-term. Often the most
   *  interesting single number in the profile. */
  tasteDrift: { type: Number, default: null, min: 0, max: 1 },

  mainstreamIndex: { type: Number, default: null },
  nostalgiaIndex: { type: Number, default: null },

  /**
   * Shannon entropy over top artists and genres, normalised to 0-1.
   *
   * This is what connects the two halves of the system: it sets the bandit's
   * exploration temperature, so persona parameterises the decision policy
   * rather than decorating a prompt.
   */
  entropy: { type: Number, default: null, min: 0, max: 1 },

  /** Play counts by local hour, for time-of-day conditioning. */
  circadian: { type: [Number], default: () => new Array(24).fill(0) },

  topArtists: { type: [String], default: [] },
  topGenres: { type: [String], default: [] },
  sampleSize: { type: Number, default: 0 },

  refreshedAt: { type: Date, default: Date.now },
});

export default mongoose.model("SpotifyPersona", spotifyPersonaSchema);
