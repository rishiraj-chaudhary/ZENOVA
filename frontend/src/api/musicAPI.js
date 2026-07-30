import apiClient from "./client.js";

export const fetchRecommendations = ({ message, conversationHistory }) =>
  apiClient.post("/music/recommend/recommendations", {
    message,
    conversationHistory,
  });

export const fetchSpotifyAuthUrl = () => apiClient.get("/music/recommend/spotify/auth");

export const exchangeSpotifyCode = ({ code, state }) =>
  apiClient.get("/music/recommend/spotify/callback", { params: { code, state } });

export const refreshSpotifyToken = (refreshToken) =>
  apiClient.post("/music/recommend/spotify/refresh", { refreshToken });
