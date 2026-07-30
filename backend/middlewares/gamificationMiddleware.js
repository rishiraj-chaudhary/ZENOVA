import { checkAndAwardBadges } from "../services/badgeService.js";
import { awardPoints, updateStreak } from "../services/pointsService.js";

/**
 * Gamification is a side effect of the user's action, not part of it. Running
 * it detached keeps a points/badge failure from turning a successful playlist
 * operation into an error response.
 */
const runInBackground = (label, task) => {
  setImmediate(() => {
    task().catch((error) => console.error(`${label} failed:`, error.message));
  });
};

/**
 * Awards points for an action once the handler has responded successfully.
 *
 * res.json is patched rather than hooking res.on("finish") so the status code
 * is known at the decision point and the award is skipped on 4xx/5xx.
 */
export const trackAction = (action) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  let awarded = false;

  res.json = (body) => {
    const succeeded = res.statusCode >= 200 && res.statusCode < 300;

    if (!awarded && succeeded && req.user?._id) {
      awarded = true;
      const userId = req.user._id;

      runInBackground(`Gamification (${action})`, async () => {
        await awardPoints(userId, action, req.socketManager);
        await checkAndAwardBadges(userId, req.socketManager);
      });
    }

    return originalJson(body);
  };

  next();
};

/** Awards the daily login bonus and advances the streak. */
export const trackDailyLogin = (req, res, next) => {
  if (req.user?._id) {
    const userId = req.user._id;

    runInBackground("Daily login tracking", async () => {
      await awardPoints(userId, "DAILY_LOGIN", req.socketManager);
      await updateStreak(userId, req.socketManager);
      await checkAndAwardBadges(userId, req.socketManager);
    });
  }

  next();
};
