import apiClient from "./client.js";

export const fetchRecommendations = ({ message, conversationHistory }) =>
  apiClient.post("/music/recommend/recommendations", {
    message,
    conversationHistory,
  });

/**
 * `intent` decides what the callback does: "login" signs you into ZENOVA with
 * your Spotify account, "connect" attaches Spotify to the account you are
 * already signed into. The server records it in the session, so the redirect
 * cannot be re-pointed at a different outcome.
 */
export const fetchSpotifyAuthUrl = (intent = "connect") =>
  apiClient.get("/music/recommend/spotify/auth", { params: { intent } });

export const exchangeSpotifyCode = ({ code, state }) =>
  apiClient.get("/music/recommend/spotify/callback", { params: { code, state } });

export const refreshSpotifyToken = (refreshToken) =>
  apiClient.post("/music/recommend/spotify/refresh", { refreshToken });
