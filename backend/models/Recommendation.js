import mongoose from "mongoose";

const recommendedTrackSchema = new mongoose.Schema(
  {
    musicId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
    reason: { type: String },
    energyLevel: { type: String },
    therapeuticFunction: { type: String },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recommendedMusic: [recommendedTrackSchema],
  detectedMood: { type: String },
  therapeuticGoal: { type: String },
  generatedAt: { type: Date, default: Date.now },
});

// Supports "most recent recommendations for this user", the only read pattern.
recommendationSchema.index({ userId: 1, generatedAt: -1 });

export default mongoose.model("Recommendation", recommendationSchema);
