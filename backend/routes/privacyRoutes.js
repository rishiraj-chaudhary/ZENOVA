import express from "express";
import { body } from "express-validator";
import {
  clearWellbeingData,
  closeAccount,
  exportData,
} from "../controllers/privacyController.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

router.use(protect);

router.get("/export", exportData);

router.delete("/wellbeing-data", clearWellbeingData);

// Typed confirmation, because this is irreversible and unrecoverable.
router.delete(
  "/account",
  [
    body("confirm")
      .equals("DELETE MY ACCOUNT")
      .withMessage('Send confirm: "DELETE MY ACCOUNT" to proceed'),
  ],
  validateRequest,
  closeAccount
);

export default router;
