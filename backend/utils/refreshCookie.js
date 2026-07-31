import config from "../config/environment.js";
import { REFRESH_TTL_MS } from "../services/refreshTokenService.js";

export const REFRESH_COOKIE = "zenova_refresh";

/**
 * Cookie options for the refresh token.
 *
 * httpOnly keeps it out of reach of any script, which is the entire point:
 * an XSS can steal an in-memory access token for its 15-minute life but cannot
 * read this and mint new ones.
 *
 * NOTE ON DOMAINS: with the app on vercel.app and the API on onrender.com this
 * is a third-party cookie. SameSite=None + Secure is required, and Safari's
 * tracking prevention may still drop it. Serving both from one registrable
 * domain (app.example.com / api.example.com) makes it first-party and removes
 * that risk. Until then the bearer-token fallback below keeps sessions working.
 */
export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: config.isProduction ? "none" : "lax",
  maxAge: REFRESH_TTL_MS,
  path: "/api/auth",
});

export const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());

export const clearRefreshCookie = (res) =>
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

/**
 * Reads the refresh token from the cookie, falling back to the request body.
 *
 * The fallback exists because third-party cookie blocking would otherwise log
 * users out every 15 minutes on Safari. It is strictly weaker — a body-carried
 * token must be stored somewhere a script can reach — so it is a compatibility
 * path, not the intended one.
 */
export const readRefreshToken = (req) =>
  req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken ?? null;
