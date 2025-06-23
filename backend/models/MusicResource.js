import mongoose from "mongoose";

const musicResourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  genre: { type: String, required: true },
  moodTags: { type: [String], default: [] }, // ["calm", "focus", "relaxing"]
  audioUrl: { type: String, required: true }, // URL to music file or Spotify URL
  duration: { type: Number, required: true }, // Duration in seconds
  recommendedFor: { type: [String], default: [] }, // ["meditation", "sleep", "study"]
  
  // Spotify-specific fields
  spotifyId: { type: String },
  spotifyUri: { type: String },
  spotifyUrl: { type: String },
  previewUrl: { type: String }, // 30-second preview URL
  albumArt: { type: String }, // Album cover image URL
  popularity: { type: Number }, // Spotify popularity score (0-100)
  explicit: { type: Boolean, default: false },

  //NEW
  // Add Spotify audio features
  audioFeatures: {
    danceability: Number,
    energy: Number,
    valence: Number, // Positivity/happiness measure
    tempo: Number,
    acousticness: Number,
    instrumentalness: Number,
    liveness: Number,
    speechiness: Number
  },
  
  // Add cultural context tags
  culturalTags: [String],
  
  // Add recommendation metadata
  recommendationScore: Number,
  lastRecommendedAt: Date
  //NEW
});

// Compound index to avoid duplicates
musicResourceSchema.index({ title: 1, artist: 1 }, { unique: true });

export default mongoose.model("MusicResource", musicResourceSchema);