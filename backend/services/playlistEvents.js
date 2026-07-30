const playlistRoom = (playlistId) => `playlist:${playlistId}`;
const userRoom = (userId) => `user:${userId}`;

/**
 * Wraps Socket.IO emission for playlist changes. Every controller previously
 * repeated the same `if (req.io) { io.to(...).emit(...) }` block — and one of
 * them forgot the guard, crashing the request when io was absent.
 */
export const createPlaylistBroadcaster = (io) => {
  const emit = (room, event, payload) => {
    if (!io) return;
    io.to(room).emit(event, payload);
  };

  return {
    toPlaylist: (playlistId, event, payload) =>
      emit(playlistRoom(playlistId), event, payload),

    toUser: (userId, event, payload) => emit(userRoom(userId), event, payload),

    /** Notifies the room and the affected user, the common collaboration case. */
    toPlaylistAndUser: (playlistId, userId, event, payload) => {
      emit(playlistRoom(playlistId), event, payload);
      emit(userRoom(userId), event, payload);
    },
  };
};

export const describeActor = (user) => ({
  userId: user._id,
  username: user.name,
});
