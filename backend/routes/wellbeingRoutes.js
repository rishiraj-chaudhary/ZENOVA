import express from "express";
import { body, param, query } from "express-validator";
import { aiLimiter } from "../config/security.js";
import {
  beginListeningSession,
  clearSongFeedback,
  getProvenSongs,
  getSongFeedback,
  finishListeningSession,
  recordSessionListened,
  getInsights,
  getMoodHistory,
  getSafetyPlan,
  getSupportResources,
  removeSafetyPlan,
  saveSafetyPlan,
  logMood,
  submitSongFeedback,
} from "../controllers/wellbeingController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

// Support contacts must never require an account or survive a rate limit.
router.get("/support", getSupportResources);


router.use(protect);

// The plan is the most sensitive data in the system: encrypted at rest, never
// sent to the model, readable only by its author.
router.get("/safety-plan", getSafetyPlan);
router.put(
  "/safety-plan",
  [
    body("warningSigns").optional(OPTIONAL).isString().isLength({ max: 2000 }),
    body("copingSteps").optional(OPTIONAL).isString().isLength({ max: 2000 }),
    body("peopleWhoHelp").optional(OPTIONAL).isString().isLength({ max: 2000 }),
    body("reasonsToStay").optional(OPTIONAL).isString().isLength({ max: 2000 }),
    body("safeEnvironment").optional(OPTIONAL).isString().isLength({ max: 2000 }),
  ],
  validateRequest,
  saveSafetyPlan
);
router.delete("/safety-plan", removeSafetyPlan);


router.post(
  "/moods",
  [
    body("mood").isString().trim().notEmpty().isLength({ max: 40 }),
    body("intensity").optional(OPTIONAL).isInt({ min: 1, max: 5 }),
    body("arousal").optional(OPTIONAL).isInt({ min: 1, max: 5 }),
    body("context").optional(OPTIONAL).isString().isLength({ max: 200 }),
  ],
  validateRequest,
  logMood
);

router.get(
  "/moods",
  [query("page").optional(OPTIONAL).isInt({ min: 1 }), query("limit").optional(OPTIONAL).isInt({ min: 1, max: 100 })],
  validateRequest,
  getMoodHistory
);

// Generating the narrative costs a model call, so it shares the AI budget.
router.get(
  "/insights",
  aiLimiter,
  [query("periodDays").optional(OPTIONAL).isInt({ min: 7, max: 365 })],
  validateRequest,
  getInsights
);

router.get("/feedback", getSongFeedback);

router.get(
  "/proven",
  [query("startingMood").optional(OPTIONAL).isInt({ min: 1, max: 5 })],
  validateRequest,
  getProvenSongs
);

router.post(
  "/feedback",
  [
    body("musicId").isMongoId(),
    body("signal").isIn(["liked", "skipped", "saved"]),
    body("sessionId").optional(OPTIONAL).isMongoId(),
    body("moodAtTime").optional(OPTIONAL).isString().trim(),
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
  [
    body("sessionId").isMongoId(),
    body("moodBefore").isInt({ min: 1, max: 5 }),
    body("arousalBefore").optional(OPTIONAL).isInt({ min: 1, max: 5 }),
  ],
  validateRequest,
  beginListeningSession
);

router.post(
  "/sessions/listened",
  [body("sessionId").isMongoId()],
  validateRequest,
  recordSessionListened
);

router.post(
  "/sessions/complete",
  [
    body("sessionId").isMongoId(),
    body("moodAfter").isInt({ min: 1, max: 5 }),
    body("arousalAfter").optional(OPTIONAL).isInt({ min: 1, max: 5 }),
  ],
  validateRequest,
  finishListeningSession
);

export default router;
