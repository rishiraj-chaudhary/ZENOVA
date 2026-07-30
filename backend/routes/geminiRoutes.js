import express from "express";
import { body } from "express-validator";
import { aiLimiter } from "../config/security.js";
import { analyzeMood, chatWithAI } from "../controllers/geminiController.js";
import { attachUserIfPresent } from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

const userInputRules = [
  body("userInput")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("userInput is required")
    .isLength({ max: 2000 })
    .withMessage("userInput is too long"),
  body("conversationHistory").optional().isArray({ max: 50 }),
];

// Guests may use these endpoints, but the rate limiter caps how much of the
// Gemini quota an anonymous caller can consume.
router.use(aiLimiter, attachUserIfPresent);

router.post("/analyze-mood", userInputRules, validateRequest, analyzeMood);
router.post("/chat", userInputRules, validateRequest, chatWithAI);

export default router;
