import crypto from "crypto";
import mongoose from "mongoose";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const playlistSongSchema = new mongoose.Schema(
  {
    musicId: { type: mongoose.Schema.Types.ObjectId, ref: "MusicResource" },
    title: String,
    artist: String,
    audioUrl: String,
    spotifyUri: String,
    albumArt: String,
    genre: String,
    reason: String,
  },
  { _id: false }
);

const playlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Set when a playlist is generated from a voice command.
    type: { type: String, default: null },
    createdBy: { type: String, enum: ["user", "voice"], default: "user" },
    moodContext: { type: String, default: null },

    inviteLink: {
      code: { type: String, default: () => crypto.randomBytes(6).toString("hex") },
      expiresAt: { type: Date, default: () => new Date(Date.now() + INVITE_TTL_MS) },
    },

    songs: [playlistSongSchema],
  },
  { timestamps: true }
);

// "My playlists" queries both fields; "accept invite" looks up by code.
playlistSchema.index({ userId: 1 });
playlistSchema.index({ collaborators: 1 });
playlistSchema.index({ "inviteLink.code": 1 });

export default mongoose.model("Playlist", playlistSchema);
