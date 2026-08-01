import apiClient from "./client.js";

// The caller's identity comes from their token, so no userId argument is needed.
export const getUserStats = () => apiClient.get("/gamification/stats");

/**
 * The period is derived server-side from the type, so it is no longer sent.
 * Weekly and monthly now aggregate points earned within the period rather than
 * reusing all-time totals, so the three tabs finally differ.
 */
export const getLeaderboard = async (type = "alltime") => {
  const { entries } = await apiClient.get("/leaderboard", { params: { type } });
  return entries ?? [];
};
