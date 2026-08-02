import mongoose from "mongoose";

/**
 * A play the user did unprompted, accumulated from Spotify's recently-played.
 *
 * That endpoint only goes 50 items deep, but it is a stream: polled every half
 * hour it becomes a longitudinal record Spotify will not hand over in one call.
 * And unlike anything else in this system it is *observational* — what someone
 * reached for on their own, with no recommendation in the loop — which is the
 * natural-experiment substrate the causal work needs.
 */
const listeningEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  spotifyTrackId: { type: String, required: true },
  title: { type: String },
  artist: { type: String },
  artistIds: { type: [String], default: [] },
  genres: { type: [String], default: [] },
  popularity: { type: Number, default: null },
  releaseYear: { type: Number, default: null },
  durationMs: { type: Number, default: null },

  playedAt: { type: Date, required: true },
  /** Local hour, so a circadian profile means the user's day. */
  hourOfDay: { type: Number, min: 0, max: 23 },
});

// The stream overlaps on every poll; the same play must land once.
listeningEventSchema.index({ userId: 1, spotifyTrackId: 1, playedAt: 1 }, { unique: true });
listeningEventSchema.index({ userId: 1, playedAt: -1 });

export default mongoose.model("ListeningEvent", listeningEventSchema);
