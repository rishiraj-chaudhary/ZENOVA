import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recommendedMusic: [
    {
      musicId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
      reason: { type: String }, // Why this music was recommended
    },
  ],
  generatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("Recommendation", recommendationSchema);