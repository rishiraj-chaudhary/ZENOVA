import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.js";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

const TOKEN_BYTES = 48;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const issueRefreshToken = async (userId, { userAgent } = {}) => {
  const token = crypto.randomBytes(TOKEN_BYTES).toString("base64url");

  await RefreshToken.create({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent,
  });

  return token;
};

/**
 * Revokes every token for a user.
 *
 * Used on logout and, importantly, on detected reuse: if a revoked token is
 * presented, either it was stolen or the legitimate client replayed it, and
 * neither case is safe to continue. Invalidating the whole family forces a
 * fresh login rather than letting an attacker ride an active chain.
 */
export const revokeAllForUser = (userId) =>
  RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

/**
 * Validates a presented token and rotates it.
 * Returns the new token, or throws if the presented one is unusable.
 */
export const rotateRefreshToken = async (presentedToken, { userAgent } = {}) => {
  if (!presentedToken) throw AppError.unauthorized("No refresh token provided");

  const presentedHash = hash(presentedToken);
  const stored = await RefreshToken.findOne({ tokenHash: presentedHash });

  if (!stored) throw AppError.unauthorized("Invalid refresh token");

  if (stored.revokedAt) {
    // A revoked token being presented means the chain has been compromised or
    // replayed. Cut off the whole family.
    logger.warn("refresh token reuse detected", { userId: stored.userId.toString() });
    await revokeAllForUser(stored.userId);
    throw AppError.unauthorized("Refresh token has been revoked");
  }

  if (stored.expiresAt < new Date()) {
    throw AppError.unauthorized("Refresh token has expired");
  }

  const nextToken = await issueRefreshToken(stored.userId, { userAgent });

  stored.revokedAt = new Date();
  stored.replacedBy = hash(nextToken);
  await stored.save();

  return { token: nextToken, userId: stored.userId };
};

export const revokeToken = async (presentedToken) => {
  if (!presentedToken) return;
  await RefreshToken.updateOne(
    { tokenHash: hash(presentedToken), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};
