import { getUserStats as loadUserStats } from "../services/gamificationService.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Always reports the authenticated caller's own stats. The previous version
 * read :userId straight from the URL, letting any signed-in user read anyone
 * else's progress.
 */
export const getUserStats = asyncHandler(async (req, res) => {
  res.json(await loadUserStats(req.user._id));
});
