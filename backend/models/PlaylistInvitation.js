import mongoose from "mongoose";

/**
 * A pending invitation awaiting the recipient's decision.
 *
 * Inviting by username previously added the person as a collaborator outright:
 * the owner saw "Invited Bob successfully" but Bob was conscripted — no prompt,
 * no accept, no decline, and a playlist he never asked for appearing in his
 * list. Mood-derived playlists are personal enough that joining one should be
 * a choice.
 */
const playlistInvitationSchema = new mongoose.Schema(
  {
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
      required: true,
      index: true,
    },
    invitedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
    respondedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// One live invitation per person per playlist. Re-inviting after a decline is
// allowed, so the constraint covers only pending ones.
playlistInvitationSchema.index(
  { playlistId: 1, invitedUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export default mongoose.model("PlaylistInvitation", playlistInvitationSchema);
