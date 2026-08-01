import express from "express";
import { body, param } from "express-validator";
import {
  acceptInvitation,
  addSongToPlaylist,
  createPlaylist,
  createPlaylistFromVoice,
  deletePlaylist,
  generateInviteLink,
  generateInviteQR,
  getCollaborators,
  getPendingInvitations,
  getUserPlaylists,
  inviteByUsername,
  respondToInvitation,
  removeCollaborator,
  removeSongFromPlaylist,
  reorderSongs,
} from "../controllers/playlistController.js";
import protect from "../middlewares/authMiddleware.js";
import { trackAction } from "../middlewares/gamificationMiddleware.js";
import validateRequest from "../middlewares/validateRequest.js";
import { OPTIONAL } from "../utils/validation.js";

const router = express.Router();

const objectId = (field, location) =>
  location(field).isMongoId().withMessage(`Invalid ${field}`);

router.use(protect);

router.get("/my-playlists", getUserPlaylists);

router.post(
  "/create",
  [body("name").isString().trim().notEmpty().withMessage("A playlist name is required")],
  validateRequest,
  trackAction("PLAYLIST_CREATED"),
  createPlaylist
);

router.post(
  "/create-from-voice",
  [
    body("command")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("A voice command is required"),
    body("conversationHistory").optional(OPTIONAL).isArray({ max: 50 }),
  ],
  validateRequest,
  trackAction("PLAYLIST_CREATED"),
  createPlaylistFromVoice
);

router.delete(
  "/delete/:playlistId",
  [objectId("playlistId", param)],
  validateRequest,
  deletePlaylist
);

router.post(
  "/addsong",
  [objectId("playlistId", body), objectId("songId", body)],
  validateRequest,
  trackAction("SONG_ADDED"),
  addSongToPlaylist
);

router.post(
  "/removesong",
  [objectId("playlistId", body), objectId("musicId", body)],
  validateRequest,
  removeSongFromPlaylist
);

router.put(
  "/:playlistId/order",
  [
    objectId("playlistId", param),
    body("musicIds").isArray({ max: 500 }).withMessage("musicIds must be an array"),
    body("musicIds.*").isMongoId().withMessage("Invalid song id"),
  ],
  validateRequest,
  reorderSongs
);

router.post(
  "/invite/username",
  [
    objectId("playlistId", body),
    body("username").isString().trim().notEmpty().withMessage("A username is required"),
  ],
  validateRequest,
  trackAction("PLAYLIST_SHARED"),
  inviteByUsername
);

router.post(
  "/invite/link/:playlistId",
  [objectId("playlistId", param)],
  validateRequest,
  trackAction("PLAYLIST_SHARED"),
  generateInviteLink
);

router.post(
  "/invite/qr/:playlistId",
  [objectId("playlistId", param)],
  validateRequest,
  trackAction("PLAYLIST_SHARED"),
  generateInviteQR
);

router.get("/invite/accept/:inviteCode", acceptInvitation);

router.get("/invitations", getPendingInvitations);

router.post(
  "/invitations/:invitationId/respond",
  [objectId("invitationId", param), body("accept").isBoolean()],
  validateRequest,
  respondToInvitation
);

router.get(
  "/:playlistId/collaborators",
  [objectId("playlistId", param)],
  validateRequest,
  getCollaborators
);

router.delete(
  "/:playlistId/collaborators/:userId",
  [objectId("playlistId", param), objectId("userId", param)],
  validateRequest,
  removeCollaborator
);

export default router;
