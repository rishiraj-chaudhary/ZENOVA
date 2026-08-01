import logger from "../utils/logger.js";
import { flushPendingAwards } from "./awardInbox.js";
import { isPlaylistMember } from "./playlistService.js";

const playlistRoom = (playlistId) => `playlist:${playlistId}`;
const userRoom = (userId) => `user:${userId}`;

/**
 * Real-time collaboration over Socket.IO.
 *
 * Two rules hold everywhere in this class:
 *
 *  1. Identity comes from `socket.data`, set by the authenticated handshake —
 *     never from the event payload. Handlers previously read `userId` and
 *     `username` off client-supplied data, so a socket could act as anyone.
 *  2. Joining a playlist room requires membership. There was no check at all,
 *     so any socket could subscribe to any playlist's traffic.
 *
 * Presence is keyed by socket id rather than user id, so a user with two tabs
 * open is present once and closing one tab does not remove them.
 */
class SocketManager {
  constructor(io) {
    this.io = io;
    /** roomId -> Map<socketId, { userId, username }> */
    this.rooms = new Map();
    this.initialize();
  }

  initialize() {
    this.io.on("connection", (socket) => {
      const { userId, username } = socket.data;
      logger.debug("socket connected", { socketId: socket.id, userId });

      // Every socket joins its own room automatically. This used to be a
      // client-triggered `register_user` carrying an arbitrary id, which let a
      // socket subscribe to another user's private notifications.
      socket.join(userRoom(userId));

      socket.on("join_playlist", ({ playlistId }) =>
        this.handleJoinPlaylist(socket, playlistId)
      );

      socket.on("leave_playlist", ({ playlistId }) =>
        this.handleLeavePlaylist(socket, playlistId)
      );

      socket.on("disconnect", () => this.handleDisconnect(socket));

      // Awards granted before this socket existed — the login bonus, chiefly —
      // are replayed now that there is somebody to receive them.
      flushPendingAwards(userId, this).catch((error) =>
        logger.warn("could not replay pending awards", { detail: error.message })
      );

      logger.debug("socket ready", { socketId: socket.id, username });
    });
  }

  /** Collapses per-socket entries into one entry per user. */
  getRoster(roomId) {
    const sockets = this.rooms.get(roomId);
    if (!sockets) return [];

    const byUser = new Map();
    sockets.forEach(({ userId, username }) => byUser.set(userId, username));

    return [...byUser.entries()].map(([id, name]) => ({
      userId: id,
      username: name,
    }));
  }

  async handleJoinPlaylist(socket, playlistId) {
    const { userId, username } = socket.data;

    // Authorization, not just authentication: being signed in does not entitle
    // you to another person's playlist traffic.
    if (!(await isPlaylistMember(playlistId, userId))) {
      logger.warn("socket denied playlist room", { userId, playlistId });
      socket.emit("join_denied", { playlistId });
      return;
    }

    const roomId = playlistRoom(playlistId);
    socket.join(roomId);

    if (!this.rooms.has(roomId)) this.rooms.set(roomId, new Map());
    this.rooms.get(roomId).set(socket.id, { userId, username });

    this.io.to(roomId).emit("user_joined", {
      userId,
      username,
      users: this.getRoster(roomId),
    });
  }

  handleLeavePlaylist(socket, playlistId) {
    const roomId = playlistRoom(playlistId);
    socket.leave(roomId);
    this.removeFromRoom(socket, roomId);
  }

  /** Shared by explicit leaves and disconnects, so both keep the roster honest. */
  removeFromRoom(socket, roomId) {
    const sockets = this.rooms.get(roomId);
    if (!sockets?.has(socket.id)) return;

    const { userId, username } = sockets.get(socket.id);
    sockets.delete(socket.id);

    if (sockets.size === 0) {
      this.rooms.delete(roomId);
      return;
    }

    const roster = this.getRoster(roomId);

    // Only announce a departure once the user's last tab has gone.
    if (!roster.some((entry) => entry.userId === userId)) {
      this.io.to(roomId).emit("user_left", { userId, username, users: roster });
    }
  }

  handleDisconnect(socket) {
    // A socket may be in several rooms; clean up every one it was tracked in.
    [...this.rooms.keys()].forEach((roomId) => this.removeFromRoom(socket, roomId));
    logger.debug("socket disconnected", { socketId: socket.id });
  }

  /** Forces a removed collaborator out of a room they no longer belong to. */
  async evictUser(playlistId, userId) {
    const roomId = playlistRoom(playlistId);
    const sockets = this.rooms.get(roomId);
    if (!sockets) return;

    const socketIds = [...sockets.entries()]
      .filter(([, entry]) => entry.userId === userId.toString())
      .map(([socketId]) => socketId);

    for (const socketId of socketIds) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(roomId);
        this.removeFromRoom(socket, roomId);
      } else {
        sockets.delete(socketId);
      }
    }
  }

  /**
   * Emits to every socket the user has open, reporting whether any existed.
   * Callers need the answer: an award emitted into an empty room is not a
   * notification, and must be replayed when they next connect.
   */
  emitToUser(userId, event, data) {
    const room = userRoom(userId);
    const delivered = (this.io.sockets.adapter.rooms.get(room)?.size ?? 0) > 0;

    this.io.to(room).emit(event, data);
    return delivered;
  }
}

export default SocketManager;
