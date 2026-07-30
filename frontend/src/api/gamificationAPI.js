import apiClient from "./client.js";

// The caller's identity comes from their token, so no userId argument is needed.
export const getUserStats = () => apiClient.get("/gamification/stats");

export const getLeaderboard = async (type = "alltime", period = "all") => {
  const { entries } = await apiClient.get("/leaderboard", {
    params: { type, period },
  });
  return entries ?? [];
};
