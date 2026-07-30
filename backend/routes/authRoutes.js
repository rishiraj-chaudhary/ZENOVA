import express from "express";
import { body } from "express-validator";
import { authLimiter } from "../config/security.js";
import {
  checkAuth,
  login,
  logout,
  register,
  sendAuthPayload,
} from "../controllers/authController.js";
import protect from "../middlewares/authMiddleware.js";
import { trackDailyLogin } from "../middlewares/gamificationMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  [
    body("name").isString().trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Enter a valid email"),
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

router.post("/logout", logout);

export default router;
