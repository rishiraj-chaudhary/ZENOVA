import mongoose from "mongoose";

/**
 * A rotating refresh token.
 *
 * Only a SHA-256 hash is stored: a database leak then yields no usable token,
 * the same reasoning that applies to passwords. Tokens are single-use — each
 * refresh revokes the presented token and issues a new one — so a stolen token
 * is detectable when it is replayed after the legitimate client has rotated.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },

    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },

    /** Set when this token was rotated, forming a chain for reuse detection. */
    replacedBy: { type: String, default: null },

    userAgent: { type: String },
  },
  { timestamps: true }
);

// Expired tokens are removed by MongoDB rather than accumulating forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RefreshToken", refreshTokenSchema);
