import Conversation from "../models/Conversation.js";
import { runAgent } from "../services/agent/index.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";

/**
 * One assistant turn.
 *
 * History is loaded from the server rather than accepted from the request. The
 * client sends only what the person just typed, which is the only thing it is
 * in a position to know.
 */
export const chat = asyncHandler(async (req, res) => {
  const { message, confirmed } = req.body;

  const conversation = await Conversation.findOne({ userId: req.user._id }).lean();

  const result = await runAgent({
    user: req.user,
    message,
    history: conversation?.turns ?? [],
    region: resolveRegion(req),
    confirmed: confirmed === true,
  });

  await Conversation.appendTurn(req.user._id, { role: "user", content: message });
  if (result.reply) {
    await Conversation.appendTurn(req.user._id, {
      role: "assistant",
      content: result.reply,
      runId: result.runId ?? null,
    });
  }

  res.json(result);
});

export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ userId: req.user._id }).lean();

  res.json({
    turns: (conversation?.turns ?? []).map(({ role, content, at }) => ({
      role,
      content,
      at,
    })),
  });
});

export const clearConversation = asyncHandler(async (req, res) => {
  await Conversation.deleteOne({ userId: req.user._id });
  res.json({ message: "Conversation cleared" });
});
