import crypto from "crypto";
import { generateRecommendations } from "../services/recommendationService.js";
import {
  buildAuthorizeUrl,
  buildEmbedUrl,
  exchangeAuthorizationCode,
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

export const getSpotifyAuthUrl = asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  req.session.spotifyAuthState = state;
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

  // Consumed only once the exchange succeeded, so a transient Spotify failure
  // leaves the user able to retry rather than permanently unable to connect.
  delete req.session.spotifyAuthState;

  res.json(tokens);
});

export const refreshSpotifyToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest("Missing refresh token");

  res.json(await refreshUserToken(refreshToken));
});
