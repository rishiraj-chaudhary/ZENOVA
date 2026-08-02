import express from "express";
import { body, param } from "express-validator";
import {
  chat,
  clearConversation,
  deleteMemory,
  getConversation,
  getMemories,
  respondToAction,
} from "../controllers/agentController.js";
import { aiLimiter } from "../config/security.js";
import protect from "../middlewares/authMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";

const router = express.Router();

router.use(protect);

router.get("/conversation", getConversation);
router.get("/memories", getMemories);
router.delete("/memories/:memoryId", [param("memoryId").isMongoId()], validateRequest, deleteMemory);
router.delete("/conversation", clearConversation);

// No conversationHistory parameter, deliberately: the server holds the
// transcript, so a client cannot rewrite what was said to steer the model.
router.post(
  "/chat",
  aiLimiter,
  [body("message").isString().trim().notEmpty().isLength({ max: 4000 })],
  validateRequest,
  chat
);

// The token is the consent, so it is the only thing that carries out a change.
router.post(
  "/actions/respond",
  [
    body("token").isString().trim().isLength({ min: 16, max: 128 }),
    body("accept").isBoolean(),
  ],
  validateRequest,
  respondToAction
);

export default router;
