import mongoose from "mongoose";

const songInteractionSchema = new mongoose.Schema(
  {
    songId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Excluded by default so no query can leak the hash by accident. The auth
    // service opts in explicitly with .select("+password").
    password: { type: String, required: true, select: false },

    preferences: { type: [String], default: [] },
    favoriteTracks: [{ type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" }],

    /** Set once the user has seen and completed the intro flow. */
    onboardedAt: { type: Date, default: null },

    /**
     * Explicit consent to store mood history (GDPR Art. 9 / DPDP special
     * category data). Absent consent, check-ins are not persisted.
     */
    consent: {
      moodTracking: { type: Boolean, default: false },
      grantedAt: { type: Date, default: null },
    },

    // Mood history lives in the MoodEntry collection — see
    // scripts/migrateMoodTracking.js for the move off the embedded array.

    sessionHistory: [
      {
        sessionType: { type: String },
        sessionDate: { type: Date, default: Date.now },
      },
    ],
    lastSessionDate: { type: Date },

    feedbackHistory: [
      {
        sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "TherapySession" },
        rating: { type: Number, min: 1, max: 5 },
        comment: { type: String },
      },
    ],

    musicBehavior: {
      likes: [songInteractionSchema],
      skips: [songInteractionSchema],
      playlistAdditions: [
        {
          songId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
          playlistId: { type: mongoose.Schema.Types.ObjectId, ref: "Playlist" },
          context: String,
          timestamp: { type: Date, default: Date.now },
        },
      ],
    },
  },
  { timestamps: true }
);

// Collaborator invites look users up by display name.
userSchema.index({ name: 1 });

export default mongoose.model("User", userSchema);
