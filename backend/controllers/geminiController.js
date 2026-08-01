import { analyzeMood as analyzeMoodService, generateChatReply } from "../services/therapyChatService.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";

/**
 * Signed-in callers get history-aware analysis; anonymous callers are served as
 * guests. Either way the caller's identity comes from their credentials, never
 * from a client-supplied userId.
 */
export const analyzeMood = asyncHandler(async (req, res) => {
  const result = await analyzeMoodService({
    userId: req.user?._id,
    userInput: req.body.userInput,
    conversationHistory: req.body.conversationHistory,
    region: resolveRegion(req),
  });

  res.json({ message: "Mood analyzed successfully", ...result });
});

export const chatWithAI = asyncHandler(async (req, res) => {
  const result = await generateChatReply({
    userId: req.user?._id,
    userInput: req.body.userInput,
    conversationHistory: req.body.conversationHistory,
    region: resolveRegion(req),
  });

  res.json(result);
});
