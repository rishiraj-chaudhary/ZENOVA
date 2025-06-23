import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  // name: { type: String, required: true },
  // email: { type: String, required: true, unique: true },
  // password: { type: String, required: true },

  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  // Preferences & Personalization
  preferences: { type: [String], default: [] }, // ["calm music", "nature sounds"]
  favoriteTracks: { type: [mongoose.Schema.Types.ObjectId], ref: "MusicResource" },

  // Therapy & Session Tracking
  moodTracking: [
    {
      mood: { type: String },
      date: { type: Date, default: Date.now },
      
    },
  ],
  sessionHistory: [
    {
      sessionType: { type: String }, // "meditation", "sleep therapy"
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
  // Add music behavior tracking
  musicBehavior: {
    likes: [{ 
      songId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
      timestamp: { type: Date, default: Date.now }
    }],
    skips: [{ 
      songId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
      timestamp: { type: Date, default: Date.now }
    }],
    playlistAdditions: [{
      songId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
      playlistId: { type: mongoose.Schema.Types.ObjectId, ref: "Playlist" },
      context: String, // "workout", "study", etc.
      timestamp: { type: Date, default: Date.now }
    }]
  },

  
});

// Add indexes for points and analytics
userSchema.index({ 'points.total': -1 });
userSchema.index({ level: -1 });
userSchema.index({ reputation: -1 });

export default mongoose.model("User", userSchema);

