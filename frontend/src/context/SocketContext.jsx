import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/api.js";
import { getAccessToken } from "../utils/authStorage.js";
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
      // A function rather than a value, so reconnects pick up a rotated access
      // token instead of replaying the one captured at mount.
      auth: (callback) => callback({ token: getAccessToken() }),
    });

    instance.on("connect", () => setConnected(true));
    instance.on("disconnect", () => setConnected(false));

    instance.on("connect_error", (error) => {
      // The server rejects unauthenticated handshakes outright.
      logSocketError(error);
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
   * Only room membership is client-driven.
   *
   * Mutations used to be emitted from here *and* broadcast by the controller
   * that performed them, so every change went out twice and each client
   * refetched twice. The server is now the single source of realtime events;
   * the client only says which room it wants to listen to. It could not be
   * trusted for mutations anyway — identity is taken from the authenticated
   * socket, not the payload.
   */
  const value = useMemo(
    () => ({
      socket,
      connected,
      joinPlaylist: (playlistId) => socket?.emit("join_playlist", { playlistId }),
      leavePlaylist: (playlistId) => socket?.emit("leave_playlist", { playlistId }),
    }),
    [socket, connected]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

const logSocketError = (error) => {
  const message = error?.message ?? "unknown";
  if (message === "Authentication required") {
    console.warn("Realtime disabled: socket authentication failed");
  } else {
    console.error("Socket connection error:", message);
  }
};

export default SocketContext;
