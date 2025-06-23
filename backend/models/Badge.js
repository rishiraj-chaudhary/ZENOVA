import mongoose from "mongoose";

// Badge Definition Schema
const badgeSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  icon: { type: String, required: true }, // URL or icon name
  rarity: { 
    type: String, 
    enum: ['common', 'rare', 'epic', 'legendary'], 
    default: 'common' 
  },
  category: { 
    type: String, 
    enum: ['creation', 'social', 'streak', 'challenge', 'therapy', 'music'], 
    required: true 
  },
  
  // Badge Requirements
  requirement: {
    type: { 
      type: String, 
      required: true 
    }, // 'playlist_count', 'streak_days', 'shares_count', 'therapy_sessions'
    value: { type: Number, required: true },
    description: { type: String } // Human readable requirement
  },
  
  // Badge Properties
  isActive: { type: Boolean, default: true },
  pointsReward: { type: Number, default: 0 }, // Extra points when earned
  color: { type: String, default: '#4F46E5' }, // Badge color theme
  
}, { 
  timestamps: true 
});

// User Badge Ownership Schema
const userBadgeSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  badgeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Badge', 
    required: true 
  },
  earnedAt: { type: Date, default: Date.now },
  isDisplayed: { type: Boolean, default: true }, // Whether user shows it on profile
  notificationSent: { type: Boolean, default: false },
  archived:{type : Boolean, default : false}
}, { 
  timestamps: true 
});

// Ensure user can't earn same badge twice
userBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

// Export both models
export const Badge = mongoose.model("Badge", badgeSchema);
export const UserBadge = mongoose.model("UserBadge", userBadgeSchema);
