import express from "express";
import { body, param, query } from "express-validator";
import { aiLimiter } from "../config/security.js";
import {
  beginListeningSession,
  clearSongFeedback,
  finishListeningSession,
  getInsights,
  getMoodHistory,
  getSupportResources,
  logMood,
  submitSongFeedback,
} from "../controllers/wellbeingController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

// Support contacts must never require an account or survive a rate limit.
router.get("/support", getSupportResources);

router.use(protect);

router.post(
  "/moods",
  [
    body("mood").isString().trim().notEmpty().isLength({ max: 40 }),
    body("intensity").optional().isInt({ min: 1, max: 5 }),
    body("context").optional().isString().isLength({ max: 200 }),
  ],
  validateRequest,
  logMood
);

router.get(
  "/moods",
  [query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })],
  validateRequest,
  getMoodHistory
);

// Generating the narrative costs a model call, so it shares the AI budget.
router.get(
  "/insights",
  aiLimiter,
  [query("periodDays").optional().isInt({ min: 7, max: 365 })],
  validateRequest,
  getInsights
);

router.post(
  "/feedback",
  [
    body("musicId").isMongoId(),
    body("signal").isIn(["liked", "skipped", "saved"]),
    body("sessionId").optional().isMongoId(),
    body("moodAtTime").optional().isString().trim(),
  ],
  validateRequest,
  submitSongFeedback
);

router.delete(
  "/feedback/:musicId",
  [param("musicId").isMongoId()],
  validateRequest,
  clearSongFeedback
);

router.post(
  "/sessions/start",
  [body("sessionId").isMongoId(), body("moodBefore").isInt({ min: 1, max: 5 })],
  validateRequest,
  beginListeningSession
);

router.post(
  "/sessions/complete",
  [body("sessionId").isMongoId(), body("moodAfter").isInt({ min: 1, max: 5 })],
  validateRequest,
  finishListeningSession
);

export default router;
