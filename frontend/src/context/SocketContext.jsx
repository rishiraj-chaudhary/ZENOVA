import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api.js";
import { useAuth } from "./AuthContext.jsx";

export const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used within a SocketProvider");
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    const instance = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    instance.on("connect", () => {
      setConnected(true);
      // Joins the personal room the server emits gamification events to.
      instance.emit("register_user", { userId: user._id });
    });

    instance.on("disconnect", () => setConnected(false));
    instance.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
      setConnected(false);
    });

    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  /**
   * Every collaboration event carries the same actor fields and requires the
   * same "connected and signed in" guard, so both live here once instead of
   * being repeated in each emitter.
   */
  const emit = useCallback(
    (event, payload = {}) => {
      if (!socket || !connected || !user) return;
      socket.emit(event, { ...payload, userId: user._id, username: user.name });
    },
    [socket, connected, user]
  );

  const value = useMemo(
    () => ({
      socket,
      connected,
      joinPlaylist: (playlistId) => emit("join_playlist", { playlistId }),
      leavePlaylist: (playlistId) => emit("leave_playlist", { playlistId }),
      addSong: (playlistId, song) => emit("add_song", { playlistId, song }),
      removeSong: (playlistId, songId) => emit("remove_song", { playlistId, songId }),
      reorderSongs: (playlistId, newOrder) =>
        emit("reorder_songs", { playlistId, newOrder }),
      notifyCollaboratorAdded: (playlistId, collaboratorId, collaboratorName) =>
        emit("collaborator_added", { playlistId, collaboratorId, collaboratorName }),
      notifyCollaboratorRemoved: (
        playlistId,
        removedCollaboratorId,
        removedCollaboratorName
      ) =>
        emit("collaborator_removed", {
          playlistId,
          removedCollaboratorId,
          removedCollaboratorName,
        }),
      notifyInvitationAccepted: (playlistId) =>
        emit("invitation_accepted", { playlistId }),
      notifyPlaylistUpdate: (playlistId) => emit("playlist_updated", { playlistId }),
    }),
    [socket, connected, emit]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

export default SocketContext;
