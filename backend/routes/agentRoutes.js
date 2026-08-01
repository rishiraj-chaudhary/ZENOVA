import express from "express";
import { body } from "express-validator";
import {
  chat,
  clearConversation,
  getConversation,
} from "../controllers/agentController.js";
import { aiLimiter } from "../config/security.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

router.use(protect);

router.get("/conversation", getConversation);
router.delete("/conversation", clearConversation);

// No conversationHistory parameter, deliberately: the server holds the
// transcript, so a client cannot rewrite what was said to steer the model.
router.post(
  "/chat",
  aiLimiter,
  [
    body("message").isString().trim().notEmpty().isLength({ max: 4000 }),
    body("confirmed").optional(OPTIONAL).isBoolean(),
  ],
  validateRequest,
  chat
);

export default router;
