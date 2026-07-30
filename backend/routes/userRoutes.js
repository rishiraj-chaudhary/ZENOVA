import express from "express";
import { body } from "express-validator";
import {
  completeOnboarding,
  getUserProfile,
  searchUsers,
  updateConsent,
  updatePreferences,
} from "../controllers/userController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

const preferenceRules = [
  // The profile form sends a single free-text string; accept it as a
  // one-element list rather than rejecting the existing client.
  body("preferences")
    .customSanitizer((value) => (typeof value === "string" ? [value] : value))
    .isArray({ max: 50 })
    .withMessage("preferences must be a list"),
  body("preferences.*").isString().trim().notEmpty(),
];

router.use(protect);

router.get("/profile", getUserProfile);
router.get("/search", searchUsers);

router.put("/preferences", preferenceRules, validateRequest, updatePreferences);

router.put(
  "/consent",
  [body("moodTracking").isBoolean().withMessage("moodTracking must be true or false")],
  validateRequest,
  updateConsent
);

router.post(
  "/onboarding",
  [...preferenceRules, body("moodTrackingConsent").optional().isBoolean()],
  validateRequest,
  completeOnboarding
);

export default router;
