import PendingAction from "../../models/PendingAction.js";
import { checkToolCall } from "./toolAuth.js";
import { dispatch, getTool, validateInput } from "./toolRegistry.js";
import { recordWrite } from "./trace.js";

/**
 * Human-readable descriptions of what a tool is about to do.
 *
 * The person is agreeing to a specific action, so the sentence they read has to
 * be the action — not the tool's name, and not a paraphrase the model wrote,
 * which could describe one thing while the arguments do another.
 */
const SUMMARIES = {
  log_checkin: (input) => `Record that you're feeling ${input.mood} (${input.intensity}/5)`,
  start_session: (input) => `Start a measured session at mood ${input.moodBefore}/5`,
  complete_session: (input) => `Record that you now feel ${input.moodAfter}/5`,
  rate_song: (input) =>
    input.signal === "skipped" ? "Stop suggesting this song" : "Remember that you liked this",
  create_playlist: (input) => `Create a playlist called "${input.name}"`,
  add_song_to_playlist: () => "Add this song to your playlist",
  delete_playlist: () => "Permanently delete this playlist",
};

export const summarise = (toolName, input) =>
  SUMMARIES[toolName]?.(input) ?? `Run ${toolName}`;

/** Records an intention and returns the token that would carry it out. */
export const propose = async ({ userId, runId, tool, input }) =>
  PendingAction.create({
    userId,
    runId,
    tool: tool.name,
    input,
    sideEffect: tool.sideEffect,
    summary: summarise(tool.name, input),
  });

/**
 * Carries out a proposal, once, for the person who was asked.
 *
 * The status transition is a conditional update, so a token cannot be redeemed
 * twice — a double-tapped Confirm creates one playlist, not two.
 */
export const redeem = async ({ token, userId, ctx }) => {
  const action = await PendingAction.findOneAndUpdate(
    { token, userId, status: "pending", expiresAt: { $gt: new Date() } },
    { status: "confirmed", resolvedAt: new Date() },
    { new: true }
  );

  if (!action) {
    return { ok: false, reason: "That confirmation has expired or was already used" };
  }

  const tool = getTool(action.tool);
  if (!tool) return { ok: false, reason: "That action is no longer available" };

  // Re-validated and re-authorized at redemption. Membership can be revoked
  // between proposing and confirming, and the answer must be current.
  const validation = validateInput(tool, action.input);
  if (!validation.valid) return { ok: false, reason: validation.error };

  const confirmedCtx = { ...ctx, confirmed: true };
  const auth = await checkToolCall({ tool, input: validation.value, ctx: confirmedCtx });
  if (!auth.allowed) return { ok: false, reason: auth.reason };

  try {
    const output = await dispatch(tool, validation.value, confirmedCtx);

    await recordWrite({
      userId,
      runId: action.runId,
      tool,
      input: validation.value,
      confirmationToken: token,
      succeeded: true,
    });

    return { ok: true, tool: tool.name, summary: action.summary, output };
  } catch (error) {
    await recordWrite({
      userId,
      runId: action.runId,
      tool,
      input: validation.value,
      confirmationToken: token,
      succeeded: false,
    });

    return { ok: false, reason: error.message };
  }
};

export const decline = async ({ token, userId }) => {
  const action = await PendingAction.findOneAndUpdate(
    { token, userId, status: "pending" },
    { status: "declined", resolvedAt: new Date() },
    { new: true }
  );

  return { ok: Boolean(action) };
};
