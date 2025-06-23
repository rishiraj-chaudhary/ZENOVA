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
  badges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }]
}, { timestamps: true });

export default mongoose.model('Gamification', gamificationSchema);
