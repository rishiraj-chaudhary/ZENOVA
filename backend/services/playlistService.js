import crypto from "crypto";
import QRCode from "qrcode";
import config from "../config/environment.js";
import MusicResource from "../models/MusicResource.js";
import Playlist from "../models/Playlist.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const generateInviteCode = () => crypto.randomBytes(6).toString("hex");

const buildInviteUrl = (code) => `${config.frontendUrl}/invite/${code}`;

const sameId = (a, b) => a?.toString() === b?.toString();

/**
 * Ownership and collaborator checks are expressed as query filters rather than
 * fetch-then-compare, so an unauthorized caller cannot read the document at all.
 */
const findOwnedPlaylist = async (playlistId, ownerId) => {
  const playlist = await Playlist.findOne({ _id: playlistId, userId: ownerId });
  if (!playlist) {
    throw AppError.notFound("Playlist not found or you do not have permission");
  }
  return playlist;
};

const findWritablePlaylist = async (playlistId, userId) => {
  const playlist = await Playlist.findOne({
    _id: playlistId,
    $or: [{ userId }, { collaborators: userId }],
  });
  if (!playlist) {
    throw AppError.notFound("Playlist not found or you do not have permission");
  }
  return playlist;
};

export const createPlaylist = ({ userId, name }) =>
  Playlist.create({ userId, name, songs: [] });

export const listPlaylistsForUser = async (userId) => {
  const playlists = await Playlist.find({
    $or: [{ userId }, { collaborators: userId }],
  }).lean();

  return playlists.map((playlist) => ({
    ...playlist,
    isOwner: sameId(playlist.userId, userId),
    isCollaborator: !sameId(playlist.userId, userId),
  }));
};

export const deletePlaylist = async ({ playlistId, ownerId }) => {
  const deleted = await Playlist.findOneAndDelete({
    _id: playlistId,
    userId: ownerId,
  });
  if (!deleted) {
    throw AppError.notFound("Playlist not found or you do not have permission");
  }
  return deleted;
};

const toPlaylistEntry = (song, reason) => ({
  musicId: song._id,
  title: song.title,
  artist: song.artist,
  audioUrl: song.audioUrl,
  genre: song.genre,
  spotifyUri: song.spotifyUri,
  albumArt: song.albumArt,
  reason,
});

export const addSongToPlaylist = async ({ playlistId, songId, userId }) => {
  const [song, playlist] = await Promise.all([
    MusicResource.findById(songId),
    findWritablePlaylist(playlistId, userId),
  ]);

  if (!song) throw AppError.notFound("Song not found");

  const isDuplicate = playlist.songs.some((entry) => sameId(entry.musicId, songId));
  if (isDuplicate) {
    throw AppError.conflict("Song already exists in this playlist", {
      type: "duplicate_song",
      songTitle: song.title,
      artist: song.artist,
      playlistName: playlist.name,
    });
  }

  playlist.songs.push(toPlaylistEntry(song, "Added by user"));
  await playlist.save();

  return { playlist, song };
};

export const removeSongFromPlaylist = async ({ playlistId, musicId, userId }) => {
  const playlist = await findWritablePlaylist(playlistId, userId);

  const remaining = playlist.songs.filter((entry) => !sameId(entry.musicId, musicId));
  if (remaining.length === playlist.songs.length) {
    throw AppError.notFound("Song is not in this playlist");
  }

  playlist.songs = remaining;
  await playlist.save();
  return playlist;
};

export const inviteCollaboratorByUsername = async ({
  playlistId,
  ownerId,
  username,
}) => {
  const playlist = await findOwnedPlaylist(playlistId, ownerId);

  const invitee = await User.findOne({ name: username }).select("name email");
  if (!invitee) throw AppError.notFound("User not found");

  if (sameId(invitee._id, ownerId)) {
    throw AppError.badRequest("You already own this playlist");
  }

  const alreadyCollaborating = playlist.collaborators.some((id) =>
    sameId(id, invitee._id)
  );
  if (alreadyCollaborating) {
    throw AppError.conflict("User is already a collaborator");
  }

  playlist.collaborators.push(invitee._id);
  await playlist.save();

  return invitee;
};

/** Issues a fresh code, invalidating any previously shared link. */
export const regenerateInviteLink = async ({ playlistId, ownerId }) => {
  const playlist = await findOwnedPlaylist(playlistId, ownerId);

  playlist.inviteLink = {
    code: generateInviteCode(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
  await playlist.save();

  return {
    inviteLink: buildInviteUrl(playlist.inviteLink.code),
    expiresAt: playlist.inviteLink.expiresAt,
  };
};

/** Reuses the current code so an existing link and its QR stay in sync. */
export const buildInviteQrCode = async ({ playlistId, ownerId }) => {
  const playlist = await findOwnedPlaylist(playlistId, ownerId);

  if (!playlist.inviteLink?.code) {
    playlist.inviteLink = {
      code: generateInviteCode(),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    };
    await playlist.save();
  }

  const inviteLink = buildInviteUrl(playlist.inviteLink.code);

  return {
    inviteLink,
    qrCode: await QRCode.toDataURL(inviteLink),
    expiresAt: playlist.inviteLink.expiresAt,
  };
};

export const acceptInvitation = async ({ inviteCode, userId }) => {
  const playlist = await Playlist.findOne({
    "inviteLink.code": inviteCode,
    "inviteLink.expiresAt": { $gt: new Date() },
  });

  if (!playlist) throw AppError.notFound("Invalid or expired invitation link");

  if (sameId(playlist.userId, userId)) {
    return { playlist, alreadyMember: true };
  }

  const alreadyCollaborating = playlist.collaborators.some((id) => sameId(id, userId));
  if (alreadyCollaborating) {
    return { playlist, alreadyMember: true };
  }

  playlist.collaborators.push(userId);
  await playlist.save();

  return { playlist, alreadyMember: false };
};

export const listCollaborators = async ({ playlistId, userId }) => {
  const playlist = await Playlist.findOne({
    _id: playlistId,
    $or: [{ userId }, { collaborators: userId }],
  })
    .populate("collaborators", "name email")
    .lean();

  if (!playlist) {
    throw AppError.notFound("Playlist not found or you do not have access");
  }

  return playlist.collaborators ?? [];
};

export const removeCollaborator = async ({ playlistId, ownerId, collaboratorId }) => {
  const playlist = await findOwnedPlaylist(playlistId, ownerId);

  const isCollaborator = playlist.collaborators.some((id) =>
    sameId(id, collaboratorId)
  );
  if (!isCollaborator) {
    throw AppError.badRequest("User is not a collaborator on this playlist");
  }

  const collaborator = await User.findById(collaboratorId).select("name");
  if (!collaborator) throw AppError.notFound("Collaborator not found");

  playlist.collaborators = playlist.collaborators.filter(
    (id) => !sameId(id, collaboratorId)
  );
  await playlist.save();

  return collaborator;
};
