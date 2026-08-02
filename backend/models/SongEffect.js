import mongoose from "mongoose";

/**
 * Measured emotional effect of one song, for people who started in one state.
 *
 * This is the asset the product is built on: nobody else holds paired
 * before/after observations linking a specific track to a specific person's
 * measured change. Everything upstream — the check-in, the session prompts —
 * exists to fill this table.
 *
 * Stored as running sufficient statistics rather than raw observations so a
 * cell can be updated with a single atomic $inc and needs no recomputation.
 * Mean and variance are derived on read.
 */
const songEffectSchema = new mongoose.Schema(
  {
    musicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MusicResource",
      required: true,
    },

    /** Starting mood bucket (1–5). Effect is conditional on where you began. */
    /**
   * The arousal the listener started at, where they gave one.
   *
   * Null means the observation predates the 2-D scale, and those cells are kept
   * separate rather than merged: a song measured to help "people at mood 2" is
   * a different claim from one measured to help "people at mood 2 who were
   * agitated", and averaging them would quietly destroy the distinction.
   */
  startingArousal: { type: Number, min: 1, max: 5, default: null },

  startingMood: { type: Number, min: 1, max: 5, required: true },

    observations: { type: Number, default: 0 },
    sumDelta: { type: Number, default: 0 },
    /** Enables variance without keeping every observation. */
    sumSquaredDelta: { type: Number, default: 0 },

    lastObservedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One cell per (song, starting state); the unique index makes the upsert safe.
songEffectSchema.index(
  { musicId: 1, startingMood: 1, startingArousal: 1 },
  { unique: true }
);
// Ranking reads scan by starting state and order by effect.
songEffectSchema.index({ startingMood: 1, observations: -1 });

/** Mean change, or null below the evidence threshold. */
songEffectSchema.virtual("meanDelta").get(function meanDelta() {
  return this.observations > 0 ? this.sumDelta / this.observations : null;
});

songEffectSchema.set("toJSON", { virtuals: true });
songEffectSchema.set("toObject", { virtuals: true });

export default mongoose.model("SongEffect", songEffectSchema);
