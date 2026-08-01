import { getLeaderboard } from "../services/leaderboardService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const fetchLeaderBoard = asyncHandler(async (req, res) => {
  // The period is derived from the type rather than accepted from the client,
  // so a caller cannot address an arbitrary period document.
  const { type = "alltime" } = req.query;
  res.json({ type, entries: await getLeaderboard(type) });
});
