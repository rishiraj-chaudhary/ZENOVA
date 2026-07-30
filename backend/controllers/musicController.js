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

export const getMusicRecommendations = asyncHandler(async (req, res) => {
  const { message, conversationHistory } = req.body;

  const result = await generateRecommendations({
    userId: req.user._id,
    message,
    conversationHistory,
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

  // Guards against CSRF on the OAuth redirect. Only enforced when a state was
  // issued in this session, so an in-flight login started before this change
  // still completes.
  const expectedState = req.session?.spotifyAuthState;
  if (expectedState && state !== expectedState) {
    throw AppError.badRequest("Invalid OAuth state");
  }
  if (req.session) delete req.session.spotifyAuthState;

  res.json(await exchangeAuthorizationCode(code));
});

export const refreshSpotifyToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest("Missing refresh token");

  res.json(await refreshUserToken(refreshToken));
});
