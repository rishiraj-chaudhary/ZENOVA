import crypto from "crypto";
import mongoose from "mongoose";

/**
 * A change the assistant wants to make, waiting for the person to agree.
 *
 * Confirmation cannot be a boolean in the request body — that is the client
 * asserting consent rather than the user giving it, and anything that can set a
 * flag can set it to true. Instead the server records what it intends to do,
 * hands back an opaque token, and will only carry it out when that exact token
 * comes back.
 *
 * Short-lived by design: an agreement to create a playlist five minutes ago is
 * not an agreement to create one now.
 */
const TTL_MINUTES = 10;

const pendingActionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: "AgentRun" },

  token: {
    type: String,
    required: true,
    unique: true,
    default: () => crypto.randomBytes(24).toString("hex"),
  },

  tool: { type: String, required: true },
  /** Frozen at proposal time, so the redeemed call is the one that was shown. */
  input: { type: mongoose.Schema.Types.Mixed, required: true },
  summary: { type: String, required: true },
  sideEffect: { type: String, enum: ["write", "destructive", "external"], required: true },

  status: {
    type: String,
    enum: ["pending", "confirmed", "declined", "expired"],
    default: "pending",
  },
  resolvedAt: { type: Date, default: null },

  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + TTL_MINUTES * 60 * 1000),
  },
});

// Mongo removes them once they lapse, so a stale token cannot be redeemed even
// if the status check were ever missed.
pendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
pendingActionSchema.index({ userId: 1, status: 1 });

export { TTL_MINUTES };
export default mongoose.model("PendingAction", pendingActionSchema);
