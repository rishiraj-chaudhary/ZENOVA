import Conversation from "../models/Conversation.js";
import { decline, redeem } from "../services/agent/confirmation.js";
import UserModel from "../models/UserModel.js";
import { runAgent } from "../services/agent/index.js";
import { confidentBeliefs } from "../services/memory/compaction.js";
import { forgetMemory, listMemories } from "../services/memory/episodicMemory.js";
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
  const { message } = req.body;

  const conversation = await Conversation.findOne({ userId: req.user._id }).lean();

  const result = await runAgent({
    user: req.user,
    message,
    history: conversation?.turns ?? [],
    region: resolveRegion(req),
    spotifyAccessToken: req.headers["x-spotify-token"] ?? null,
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

/**
 * Carries out something the assistant proposed, or declines it.
 *
 * The token is the consent. A boolean in the body would be the client asserting
 * agreement rather than the person giving it.
 */
export const respondToAction = asyncHandler(async (req, res) => {
  const { token, accept } = req.body;

  if (accept !== true) {
    const declined = await decline({ token, userId: req.user._id });
    return res.json({ ok: declined.ok, performed: false });
  }

  const result = await redeem({
    token,
    userId: req.user._id,
    ctx: {
      userId: req.user._id,
      timeZone: req.user.timeZone ?? "UTC",
      consent: { moodTracking: req.user.consent?.moodTracking ?? false },
      spotify: {
        connected: Boolean(req.user.spotifyId),
        accessToken: req.headers["x-spotify-token"] ?? null,
      },
      socketManager: req.socketManager,
      tainted: false,
    },
  });

  if (!result.ok) return res.status(409).json({ ok: false, reason: result.reason });

  await Conversation.appendTurn(req.user._id, {
    role: "assistant",
    content: `Done — ${result.summary.toLowerCase()}.`,
  });

  res.json({ ok: true, performed: true, summary: result.summary, result: result.output });
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

/**
 * What the assistant remembers, and the ability to delete any of it.
 *
 * Memory the user cannot see is a liability; memory they can edit is a feature.
 */
export const getMemories = asyncHandler(async (req, res) => {
  const [memories, profile] = await Promise.all([
    listMemories(req.user._id),
    UserModel.findOne({ userId: req.user._id }).lean(),
  ]);

  res.json({
    memories,
    beliefs: confidentBeliefs(profile),
  });
});

export const deleteMemory = asyncHandler(async (req, res) => {
  const { deletedCount } = await forgetMemory(req.user._id, req.params.memoryId);
  res.json({ deleted: deletedCount > 0 });
});

export const clearConversation = asyncHandler(async (req, res) => {
  await Conversation.deleteOne({ userId: req.user._id });
  res.json({ message: "Conversation cleared" });
});
