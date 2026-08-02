import express from "express";
import { body, param } from "express-validator";
import {
  attachSession,
  getCurrent,
  getDirections,
  getReadout,
  pause,
  preview,
  refresh,
  resume,
  start,
  stop,
} from "../controllers/planController.js";
import { DIRECTIONS, DURATIONS } from "../models/ListeningPlan.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

router.use(protect);

const planShape = [
  body("direction").isIn(Object.keys(DIRECTIONS)),
  body("durationDays").isInt().custom((value) => DURATIONS.includes(Number(value))),
];

router.get("/directions", getDirections);
router.get("/current", getCurrent);
router.get("/readout", getReadout);

router.post("/preview", planShape, validateRequest, preview);

router.post(
  "/start",
  [...planShape, body("reminderHour").optional(OPTIONAL).isInt({ min: 0, max: 23 })],
  validateRequest,
  start
);

router.post(
  "/steps/:stepId/session",
  [param("stepId").isMongoId(), body("sessionId").isMongoId()],
  validateRequest,
  attachSession
);

router.post("/pause", pause);
router.post("/resume", resume);
router.post("/stop", stop);
router.post("/refresh", refresh);

export default router;
