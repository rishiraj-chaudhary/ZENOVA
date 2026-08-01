import User from "../models/user.js";
import {
  authenticateUser,
  issueAccessToken,
  registerUser,
  toPublicUser,
} from "../services/authService.js";
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeToken,
  rotateRefreshToken,
} from "../services/refreshTokenService.js";
import { establishSession } from "../services/authSessionService.js";
import { destroySessionsForUser } from "../services/sessionStoreService.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  clearRefreshCookie,
  readRefreshToken,
  setRefreshCookie,
} from "../utils/refreshCookie.js";

/**
 * Issues the credential pair and stages the response body.
 *
 * The refresh token goes in an httpOnly cookie so no script can read it. It is
 * also returned in the body as a compatibility path for clients whose browser
 * blocks the cross-site cookie — see utils/refreshCookie.js.
 */

export const register = asyncHandler(async (req, res) => {
  const { user } = await registerUser(req.body);
  const payload = await establishSession(req, res, user);

  res.status(201).json({ message: "User registered successfully", ...payload });
});

/**
 * Authenticates, then hands off to the gamification middleware before the
 * response is written.
 *
 * The previous implementation called res.json() and *then* next(), so the daily
 * login and streak middleware ran against an already-sent response. Staging the
 * payload in res.locals and letting sendAuthPayload finish the request keeps the
 * middleware chain meaningful.
 */
export const login = asyncHandler(async (req, res, next) => {
  const { user } = await authenticateUser(req.body);

  req.session.user = user;
  req.user = user;
  res.locals.authPayload = await establishSession(req, res, user);

  next();
});

export const checkAuth = asyncHandler(async (req, res, next) => {
  if (!req.user) throw AppError.unauthorized("Not authenticated");

  res.locals.authPayload = { user: toPublicUser(req.user) };
  next();
});

/** Terminal handler for the auth chain, after gamification side effects run. */
export const sendAuthPayload = (req, res) => {
  res.json(res.locals.authPayload);
};

/**
 * Exchanges a refresh token for a new access token, rotating the refresh token
 * in the process so each one is single-use.
 */
export const refresh = asyncHandler(async (req, res) => {
  const presented = readRefreshToken(req);

  const { token, userId } = await rotateRefreshToken(presented, {
    userAgent: req.headers["user-agent"],
  });

  const user = await User.findById(userId).select("-password").lean();
  if (!user) {
    await revokeAllForUser(userId);
    throw AppError.unauthorized("Account no longer exists");
  }

  setRefreshCookie(res, token);

  res.json({
    user: { ...toPublicUser(user), token: issueAccessToken(userId) },
    refreshToken: token,
  });
});

export const logout = asyncHandler(async (req, res) => {
  await revokeToken(readRefreshToken(req));
  clearRefreshCookie(res);

  if (!req.session) {
    return res.json({ message: "Logged out successfully" });
  }

  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

/** Signs the user out everywhere, e.g. after a suspected compromise. */
export const logoutAllDevices = asyncHandler(async (req, res) => {
  await revokeAllForUser(req.user._id);
  clearRefreshCookie(res);

  // authMiddleware accepts an express session as credentials in its own right,
  // so revoking refresh tokens alone left every other device fully signed in
  // while the response claimed otherwise. The session store is Mongo-backed, so
  // the other devices' sessions can actually be destroyed.
  await destroySessionsForUser(req.user._id);
  req.session?.destroy?.(() => {});

  res.json({ message: "Signed out on all devices" });
});
