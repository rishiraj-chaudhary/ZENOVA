import express from "express";
import { body } from "express-validator";
import { authLimiter } from "../config/security.js";
import {
  checkAuth,
  login,
  logout,
  logoutAllDevices,
  refresh,
  register,
  sendAuthPayload,
} from "../controllers/authController.js";
import protect from "../middlewares/authMiddleware.js";
import { trackDailyLogin } from "../middlewares/gamificationMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  [
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Enter a valid email"),
    body("timeZone").optional(OPTIONAL).isString().isLength({ max: 64 }),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password should be 6 characters or more"),
  ],
  validateRequest,
  register
);

router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().normalizeEmail().withMessage("Enter a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validateRequest,
  login,
  trackDailyLogin,
  sendAuthPayload
);

router.get("/check-session", protect, checkAuth, trackDailyLogin, sendAuthPayload);

// Rate limited because an attacker with a stolen token would otherwise be able
// to probe it freely. Not behind `protect`: the whole point is that the access
// token has already expired.
router.post("/refresh", authLimiter, refresh);

router.post("/logout", logout);
router.post("/logout-all", protect, logoutAllDevices);

export default router;
