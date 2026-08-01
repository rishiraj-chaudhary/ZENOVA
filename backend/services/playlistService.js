import crypto from "crypto";
import mongoose from "mongoose";
import QRCode from "qrcode";
import config from "../config/environment.js";
import MusicResource from "../models/MusicResource.js";
import Playlist from "../models/Playlist.js";
import PlaylistInvitation from "../models/PlaylistInvitation.js";
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

/**
 * Whether a user may receive this playlist's realtime traffic.
 *
 * An existence check rather than a fetch: the socket layer needs the boolean,
 * not the document, and this runs on every room join.
 */
export const isPlaylistMember = async (playlistId, userId) => {
  if (!mongoose.isValidObjectId(playlistId) || !userId) return false;

  return Boolean(
    await Playlist.exists({
      _id: playlistId,
      $or: [{ userId }, { collaborators: userId }],
    })
  );
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

  // Otherwise the invitation outlives the playlist: it sits in the recipient's
  // inbox naming something that no longer exists, and accepting it reports
  // success while joining nothing.
  await PlaylistInvitation.deleteMany({ playlistId, status: "pending" });

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
  previewUrl: song.previewUrl,
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

/**
 * Persists a new song order.
 *
 * Ordering was previously broadcast over a socket and never written down, so
 * every collaborator saw the drag and the order reverted on the next load.
 *
 * `musicIds` is treated as a preference, not as the whole truth: a client that
 * started dragging before a collaborator added a song would otherwise submit a
 * stale list and silently delete that song. Anything the client did not mention
 * keeps its relative order and follows.
 */
export const reorderPlaylistSongs = async ({ playlistId, musicIds, userId }) => {
  const playlist = await findWritablePlaylist(playlistId, userId);

  const byId = new Map(playlist.songs.map((song) => [song.musicId?.toString(), song]));

  const seen = new Set();
  const ordered = [];
  for (const id of musicIds) {
    const key = id?.toString();
    if (!byId.has(key)) throw AppError.badRequest("That song is not in this playlist");
    if (seen.has(key)) throw AppError.badRequest("Duplicate song in the new order");
    seen.add(key);
    ordered.push(byId.get(key));
  }

  const untouched = playlist.songs.filter(
    (song) => !seen.has(song.musicId?.toString())
  );

  playlist.songs = [...ordered, ...untouched];
  await playlist.save();

  return playlist;
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

/**
 * Creates a pending invitation. The recipient decides whether to join.
 *
 * This used to push the user straight into `collaborators`, so the owner saw
 * "Invited successfully" while the recipient was simply added without being
 * asked.
 */
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

  try {
    await PlaylistInvitation.create({
      playlistId,
      invitedUserId: invitee._id,
      invitedByUserId: ownerId,
    });
  } catch (error) {
    // The partial unique index rejects a second pending invitation.
    if (error.code === 11000) {
      throw AppError.conflict("That person already has a pending invitation");
    }
    throw error;
  }

  return { invitee, playlistName: playlist.name };
};

/** Invitations awaiting this user's decision. */
export const listPendingInvitations = (userId) =>
  PlaylistInvitation.find({ invitedUserId: userId, status: "pending" })
    .populate("playlistId", "name songs")
    .populate("invitedByUserId", "name")
    .sort({ createdAt: -1 })
    .lean();

/**
 * Records the recipient's decision, adding them as a collaborator only on
 * acceptance.
 */
export const respondToInvitation = async ({ invitationId, userId, accept }) => {
  const invitation = await PlaylistInvitation.findOneAndUpdate(
    { _id: invitationId, invitedUserId: userId, status: "pending" },
    { status: accept ? "accepted" : "declined", respondedAt: new Date() },
    { new: true }
  );

  if (!invitation) throw AppError.notFound("Invitation not found");

  // Declining has to remove them if they are already in — someone can accept an
  // invite link and then decline the pending invitation for the same playlist,
  // and "Decline" that leaves you a collaborator is not a decline.
  if (!accept) {
    const playlist = await Playlist.findByIdAndUpdate(
      invitation.playlistId,
      { $pull: { collaborators: userId } },
      { new: true }
    );

    return { invitation, playlist: null, removedFrom: playlist };
  }

  const playlist = await Playlist.findByIdAndUpdate(
    invitation.playlistId,
    { $addToSet: { collaborators: userId } },
    { new: true }
  );

  return { invitation, playlist };
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

  // Reusing the code kept an existing link and its QR in sync, but it also
  // handed out QR codes for codes that had already expired — most playlists in
  // the database are past their seven days — and acceptInvitation rejects
  // those, so the QR scanned to "Invalid or expired invitation link".
  const expired =
    !playlist.inviteLink?.expiresAt || playlist.inviteLink.expiresAt <= new Date();

  if (!playlist.inviteLink?.code || expired) {
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
    // Names only. Emails were populated here and rendered in the UI, so joining
    // any shared playlist disclosed every other collaborator's email address.
    .populate("collaborators", "name")
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

  // Removal has to revoke the invite link too. Anyone who still holds the URL —
  // the person just removed, most obviously — could re-join with a single
  // request, so the removal only appeared to work.
  playlist.inviteLink = {
    code: generateInviteCode(),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };

  await playlist.save();

  return collaborator;
};
