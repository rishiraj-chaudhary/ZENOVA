import express from "express";
import { getOperationalSnapshot } from "../controllers/opsController.js";
import protect from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Population aggregates that name nobody, plus this caller's own activity, so
// there is no admin role to get wrong.
router.get("/snapshot", getOperationalSnapshot);

export default router;
