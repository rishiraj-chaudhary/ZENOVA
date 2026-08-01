import { createPlaylistBroadcaster, describeActor } from "../services/playlistEvents.js";
import * as playlistService from "../services/playlistService.js";
import { createPlaylistFromVoiceCommand } from "../services/voicePlaylistService.js";
import asyncHandler from "../utils/asyncHandler.js";

const broadcasterFor = (req) => createPlaylistBroadcaster(req.io);

export const createPlaylist = asyncHandler(async (req, res) => {
  const playlist = await playlistService.createPlaylist({
    userId: req.user._id,
    name: req.body.name,
  });

  res.status(201).json(playlist);
});

export const getUserPlaylists = asyncHandler(async (req, res) => {
  res.json(await playlistService.listPlaylistsForUser(req.user._id));
});

export const deletePlaylist = asyncHandler(async (req, res) => {
  await playlistService.deletePlaylist({
    playlistId: req.params.playlistId,
    ownerId: req.user._id,
  });

  res.json({ message: "Playlist deleted successfully" });
});

export const createPlaylistFromVoice = asyncHandler(async (req, res) => {
  const playlist = await createPlaylistFromVoiceCommand({
    userId: req.user._id,
    command: req.body.command,
    conversationHistory: req.body.conversationHistory,
  });

  res.status(201).json({
    message: "Playlist created successfully from voice command",
    playlist,
  });
});

export const addSongToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, songId } = req.body;

  const { playlist, song } = await playlistService.addSongToPlaylist({
    playlistId,
    songId,
    userId: req.user._id,
  });

  broadcasterFor(req).toPlaylist(playlistId, "song_added", {
    playlistId,
    song: { musicId: song._id, title: song.title, artist: song.artist },
    addedBy: describeActor(req.user),
  });

  res.json(playlist);
});

export const removeSongFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, musicId } = req.body;

  await playlistService.removeSongFromPlaylist({
    playlistId,
    musicId,
    userId: req.user._id,
  });

  broadcasterFor(req).toPlaylist(playlistId, "song_removed", {
    playlistId,
    songId: musicId,
    removedBy: describeActor(req.user),
  });

  res.json({ message: "Song removed successfully" });
});

export const reorderSongs = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  const playlist = await playlistService.reorderPlaylistSongs({
    playlistId,
    musicIds: req.body.musicIds,
    userId: req.user._id,
  });

  // Carries the resulting order so collaborators apply the same list rather
  // than each refetching.
  broadcasterFor(req).toPlaylist(playlistId, "songs_reordered", {
    playlistId,
    musicIds: playlist.songs.map((song) => song.musicId),
    reorderedBy: describeActor(req.user),
  });

  res.json(playlist);
});

export const inviteByUsername = asyncHandler(async (req, res) => {
  const { playlistId, username } = req.body;

  const { invitee, playlistName } = await playlistService.inviteCollaboratorByUsername({
    playlistId,
    ownerId: req.user._id,
    username,
  });

  // The recipient is notified so they can decide; nobody is added yet.
  broadcasterFor(req).toUser(invitee._id, "invitation_received", {
    playlistId,
    playlistName,
    invitedBy: describeActor(req.user),
  });

  res.json({
    message: `Invitation sent to ${invitee.name}`,
    invitee: { _id: invitee._id, name: invitee.name },
  });
});

export const getPendingInvitations = asyncHandler(async (req, res) => {
  res.json({ invitations: await playlistService.listPendingInvitations(req.user._id) });
});

export const respondToInvitation = asyncHandler(async (req, res) => {
  const { invitationId } = req.params;
  const accept = req.body.accept === true;

  const { playlist } = await playlistService.respondToInvitation({
    invitationId,
    userId: req.user._id,
    accept,
  });

  if (accept && playlist) {
    // Announced only once they have actually joined, and as the event the
    // collaborators panel already listens for.
    broadcasterFor(req).toPlaylist(playlist._id, "collaborator_added", {
      playlistId: playlist._id,
      collaborator: describeActor(req.user),
      addedBy: describeActor(req.user),
    });
  }

  res.json({
    message: accept ? "Invitation accepted" : "Invitation declined",
    playlistId: playlist?._id ?? null,
  });
});

export const generateInviteLink = asyncHandler(async (req, res) => {
  const result = await playlistService.regenerateInviteLink({
    playlistId: req.params.playlistId,
    ownerId: req.user._id,
  });

  res.json({ message: "Invite link generated successfully", ...result });
});

export const generateInviteQR = asyncHandler(async (req, res) => {
  const result = await playlistService.buildInviteQrCode({
    playlistId: req.params.playlistId,
    ownerId: req.user._id,
  });

  res.json({ message: "QR code generated successfully", ...result });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const { playlist, alreadyMember } = await playlistService.acceptInvitation({
    inviteCode: req.params.inviteCode,
    userId: req.user._id,
  });

  if (!alreadyMember) {
    // Not "user_joined": that event carries the full presence roster and the
    // client replaces its list with `data.users`, so emitting it from here —
    // with no roster to send — blanked "Who's Listening" for everyone watching.
    // Joining as a collaborator is not the same thing as being present.
    broadcasterFor(req).toPlaylist(playlist._id, "collaborator_added", {
      playlistId: playlist._id,
      collaborator: describeActor(req.user),
      addedBy: describeActor(req.user),
      joinedVia: "invitation",
    });
  }

  res.json({
    message: alreadyMember
      ? "You are already a collaborator on this playlist"
      : "Successfully joined playlist as collaborator",
    playlistId: playlist._id,
  });
});

export const getCollaborators = asyncHandler(async (req, res) => {
  const collaborators = await playlistService.listCollaborators({
    playlistId: req.params.playlistId,
    userId: req.user._id,
  });

  res.json({ collaborators });
});

export const removeCollaborator = asyncHandler(async (req, res) => {
  const { playlistId, userId } = req.params;

  const collaborator = await playlistService.removeCollaborator({
    playlistId,
    ownerId: req.user._id,
    collaboratorId: userId,
  });

  broadcasterFor(req).toPlaylistAndUser(
    playlistId,
    collaborator._id,
    "collaborator_removed",
    {
      playlistId,
      removedCollaborator: { userId: collaborator._id, username: collaborator.name },
      removedBy: describeActor(req.user),
    }
  );

  // Leaving them in the room would keep delivering updates for a playlist they
  // no longer have access to.
  await req.socketManager?.evictUser?.(playlistId, collaborator._id);

  res.json({ message: "Collaborator removed successfully" });
});
