import mongoose from "mongoose";

const leaderboardEntrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  totalPoints: { type: Number, required: true },
  level: { type: Number, required: true },
  currentStreak: { type: Number, default: 0 },
  badgeCount: { type: Number, default: 0 }
}, { _id: false });

const leaderboardSchema = new mongoose.Schema({
  type: { type: String, enum: ['alltime', 'weekly', 'monthly'], required: true },
  period: { type: String, required: true }, // e.g. "2025-W24" for weekly, "2025-06" for monthly
  entries: [leaderboardEntrySchema],
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

leaderboardSchema.index({ type: 1, period: 1 }, { unique: true });

export default mongoose.model('Leaderboard', leaderboardSchema);
