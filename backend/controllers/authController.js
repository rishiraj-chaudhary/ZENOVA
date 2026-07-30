import { authenticateUser, registerUser, toPublicUser } from "../services/authService.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerUser(req.body);

  res.status(201).json({
    message: "User registered successfully",
    token,
    user,
  });
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
  const { user, token } = await authenticateUser(req.body);

  req.session.user = user;
  req.user = user;
  res.locals.authPayload = { user: { ...user, token } };

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

export const logout = (req, res, next) => {
  if (!req.session) {
    return res.json({ message: "Logged out successfully" });
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
};
