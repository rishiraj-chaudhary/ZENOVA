import apiClient from "./client.js";

export const fetchMyPlaylists = () => apiClient.get("/playlists/my-playlists");

export const createPlaylist = (name) => apiClient.post("/playlists/create", { name });

export const createPlaylistFromVoice = ({ command, conversationHistory }) =>
  apiClient.post("/playlists/create-from-voice", { command, conversationHistory });

export const deletePlaylist = (playlistId) =>
  apiClient.delete(`/playlists/delete/${playlistId}`);

export const addSong = ({ playlistId, songId }) =>
  apiClient.post("/playlists/addsong", { playlistId, songId });

export const removeSong = ({ playlistId, musicId }) =>
  apiClient.post("/playlists/removesong", { playlistId, musicId });

export const fetchCollaborators = (playlistId) =>
  apiClient.get(`/playlists/${playlistId}/collaborators`);

export const removeCollaborator = ({ playlistId, userId }) =>
  apiClient.delete(`/playlists/${playlistId}/collaborators/${userId}`);

export const inviteByUsername = ({ playlistId, username }) =>
  apiClient.post("/playlists/invite/username", { playlistId, username });

export const generateInviteLink = (playlistId) =>
  apiClient.post(`/playlists/invite/link/${playlistId}`);

export const generateInviteQR = (playlistId) =>
  apiClient.post(`/playlists/invite/qr/${playlistId}`);

export const acceptInvitation = (inviteCode) =>
  apiClient.get(`/playlists/invite/accept/${inviteCode}`);
