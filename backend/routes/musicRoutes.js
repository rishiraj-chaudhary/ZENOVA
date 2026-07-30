import express from "express";
import { body, param } from "express-validator";
import { aiLimiter } from "../config/security.js";
import {
  getMusicRecommendations,
  getSpotifyAuthUrl,
  getSpotifyEmbed,
  handleSpotifyCallback,
  refreshSpotifyToken,
} from "../controllers/musicController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

router.post(
  "/recommendations",
  protect,
  aiLimiter,
  [
    body("message").isString().trim().notEmpty().withMessage("A message is required"),
    body("conversationHistory")
      .optional()
      .isArray({ max: 50 })
      .withMessage("conversationHistory must be an array"),
  ],
  validateRequest,
  getMusicRecommendations
);

router.get(
  "/spotify/embed/:trackId",
  [param("trackId").isAlphanumeric().withMessage("Invalid track id")],
  validateRequest,
  getSpotifyEmbed
);

router.get("/spotify/auth", getSpotifyAuthUrl);
router.get("/spotify/callback", handleSpotifyCallback);
router.post("/spotify/refresh", refreshSpotifyToken);

export default router;
