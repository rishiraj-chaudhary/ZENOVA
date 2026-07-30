// backend/models/Gamification.js
import mongoose from "mongoose";

const gamificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  totalPoints: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now },
  playlistsShared: { type: Number, default: 0 },
  playlistsCreated:{type: Number, default: 0},
  songsAdded:{type: Number, default: 0},
  dailyLogins: { type: Number, default: 0 },
  // When the streak grace period was last consumed, so it cannot be used
  // repeatedly to keep a streak alive indefinitely.
  lastGraceUsedAt: { type: Date, default: null },
  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }]
}, { timestamps: true });

// One stats document per user, and the leaderboard sorts on these three.
gamificationSchema.index({ userId: 1 }, { unique: true });
gamificationSchema.index({ totalPoints: -1, level: -1, currentStreak: -1 });

export default mongoose.model('Gamification', gamificationSchema);
