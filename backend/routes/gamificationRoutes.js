import express from "express";
import { getUserStats } from "../controllers/gamificationController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

// The client also calls /stats/:userId; both resolve to the caller's own stats.
router.get("/stats", getUserStats);
router.get("/stats/:userId", getUserStats);

export default router;
