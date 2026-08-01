import express from "express";
import { query } from "express-validator";
import { fetchLeaderBoard } from "../controllers/leaderboardController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

// Usernames and progress were readable by anyone; the board is a signed-in
// surface like every sibling route.
router.use(protect);

router.get(
  "/",
  [query("type").optional(OPTIONAL).isIn(["alltime", "weekly", "monthly"])],
  validateRequest,
  fetchLeaderBoard
);

export default router;
