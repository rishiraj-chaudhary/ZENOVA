import { getLeaderboard } from "../services/leaderboardService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const fetchLeaderBoard = asyncHandler(async (req, res) => {
  const { type = "alltime", period = "all" } = req.query;
  res.json({ entries: await getLeaderboard(type, period) });
});
