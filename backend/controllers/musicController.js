import crypto from "crypto";
import { establishSession } from "../services/authSessionService.js";
import {
  findOrCreateSpotifyUser,
  linkSpotifyAccount,
} from "../services/authService.js";
import { generateRecommendations } from "../services/recommendationService.js";
import {
  buildAuthorizeUrl,
  buildEmbedUrl,
  exchangeAuthorizationCode,
  fetchSpotifyProfile,
  refreshUserToken,
} from "../services/spotifyService.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";

export const getMusicRecommendations = asyncHandler(async (req, res) => {
  const { message, conversationHistory } = req.body;

  const result = await generateRecommendations({
    userId: req.user._id,
    message,
    conversationHistory,
    region: resolveRegion(req),
  });

  res.json(result);
});

export const getSpotifyEmbed = asyncHandler(async (req, res) => {
  res.json({ embedUrl: buildEmbedUrl(req.params.trackId) });
});

/**
 * Starts the Spotify OAuth flow.
 *
 * `intent` decides what the callback does with the result: "login" signs the
 * person into ZENOVA (creating an account the first time), "connect" attaches
 * Spotify to the account they are already signed into. It is recorded in the
 * session rather than taken from the callback's query string, so the redirect
 * cannot be re-pointed at a different outcome than the one that was started.
 */
export const getSpotifyAuthUrl = asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  req.session.spotifyAuthState = state;
  req.session.spotifyAuthIntent = req.query.intent === "login" ? "login" : "connect";

  res.json({ authUrl: buildAuthorizeUrl(state) });
});

export const handleSpotifyCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw AppError.badRequest("Missing authorization code");

  // Fails closed. Enforcing only "when a state was issued" made the check
  // worthless: an attacker just has to get the victim to the callback without a
  // session, and since the state was also deleted before the exchange, any
  // retry arrived with none. Both holes let an attacker's authorization code be
  // exchanged into the victim's browser.
  const expectedState = req.session?.spotifyAuthState;
  if (!expectedState || state !== expectedState) {
    throw AppError.badRequest("Invalid or missing OAuth state");
  }

  const tokens = await exchangeAuthorizationCode(code);
  const intent = req.session.spotifyAuthIntent ?? "connect";

  // Consumed only once the exchange succeeded, so a transient Spotify failure
  // leaves the user able to retry rather than permanently unable to connect.
  delete req.session.spotifyAuthState;
  delete req.session.spotifyAuthIntent;

  // Playback-only: hand back the tokens and leave ZENOVA's own session alone.
  if (intent !== "login" && !req.user) {
    return res.json(tokens);
  }

  const profile = await fetchSpotifyProfile(tokens.accessToken);

  // Already signed in — attach Spotify to this account rather than making a
  // second one. This is also the only way to put Spotify on an account that
  // was created with a password.
  if (req.user) {
    const { user } = await linkSpotifyAccount({
      userId: req.user._id,
      spotifyId: profile.spotifyId,
    });

    return res.json({ ...tokens, user, linked: true });
  }

  const { user, created } = await findOrCreateSpotifyUser(profile);
  const session = await establishSession(req, res, user);

  req.session.user = session.user;

  res.json({ ...tokens, ...session, created });
});

export const refreshSpotifyToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest("Missing refresh token");

  res.json(await refreshUserToken(refreshToken));
});
