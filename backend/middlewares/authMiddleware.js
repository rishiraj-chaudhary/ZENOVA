import jwt from "jsonwebtoken";
import config from "../config/environment.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

const extractBearerToken = (req) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
};

/**
 * Resolves the caller's id from either a Bearer JWT or an established session,
 * in that order. Returns null when the request carries neither.
 */
const resolveUserId = (req) => {
  const token = extractBearerToken(req);
  if (token) return jwt.verify(token, config.jwt.secret).id;
  return req.session?.user?._id ?? null;
};

/** Rejects the request unless it carries valid credentials. */
const protect = asyncHandler(async (req, res, next) => {
  const userId = resolveUserId(req);
  if (!userId) {
    throw AppError.unauthorized("Not authorized, no authentication provided");
  }

  const authenticatedUser = await User.findById(userId).select("-password");
  if (!authenticatedUser) {
    throw AppError.unauthorized("Not authorized, user no longer exists");
  }

  req.user = authenticatedUser;
  next();
});

/**
 * Populates req.user when credentials are present but never rejects. For
 * endpoints that personalise their response for signed-in users yet stay
 * usable for guests.
 */
export const attachUserIfPresent = asyncHandler(async (req, res, next) => {
  try {
    const userId = resolveUserId(req);
    if (userId) {
      req.user = await User.findById(userId).select("-password");
    }
  } catch {
    // An invalid token on an optional-auth route just means "treat as guest".
  }
  next();
});

export default protect;
