import express from "express";
import { body, param } from "express-validator";
import { aiLimiter } from "../config/security.js";
import {
  getMusicRecommendations,
  getSpotifyAuthUrl,
  getSpotifyEmbed,
  handleSpotifyCallback,
  getMyPersona,
  getPlaybackOptions,
  playOnDevice,
  refreshSpotifyToken,
  syncListening,
} from "../controllers/musicController.js";
import protect, { attachUserIfPresent } from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

router.post(
  "/recommendations",
  protect,
  aiLimiter,
  [
    body("message").isString().trim().notEmpty().withMessage("A message is required"),
    body("conversationHistory")
      .optional(OPTIONAL)
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

// Optional auth on both: signed out, the callback signs the person in with
// their Spotify account; signed in, it attaches Spotify to the account they
// already have. Requiring a token would make the first case impossible.
router.get("/spotify/auth", attachUserIfPresent, getSpotifyAuthUrl);
router.get("/spotify/callback", attachUserIfPresent, handleSpotifyCallback);
router.post("/spotify/refresh", refreshSpotifyToken);

// Playback and persona need a signed-in ZENOVA user; the Spotify token travels
// in a header because it belongs to the browser's Spotify session, not ours.
router.get("/spotify/playback-options", protect, getPlaybackOptions);
router.put(
  "/spotify/play",
  protect,
  [body("uris").isArray({ min: 1, max: 50 }), body("deviceId").optional(OPTIONAL).isString()],
  validateRequest,
  playOnDevice
);
router.post("/spotify/sync-listening", protect, syncListening);
router.get("/spotify/persona", protect, getMyPersona);

export default router;
