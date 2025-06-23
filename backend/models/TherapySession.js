import mongoose from "mongoose";

const therapySessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sessionType: { type: String, required: true }, // "meditation", "focus", "sleep therapy"
  musicUsed: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
  sessionDuration: { type: Number, required: true }, // Duration in minutes
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String },
  },
  date: { type: Date, default: Date.now },
});

export default mongoose.model("TherapySession", therapySessionSchema);