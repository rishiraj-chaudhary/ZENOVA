import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { refreshSession } from "../api/client.js";
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

    // Guards against a refresh storm if the token is genuinely dead.
    let retriedAfterRefresh = false;
    let disposed = false;

    const instance = io(SOCKET_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      /**
       * Mints a token for every connection attempt.
       *
       * The access token expires after 15 minutes and the only thing that
       * renewed it was an HTTP 401 on some unrelated REST call. So a tab open
       * longer than that reconnected — after a wifi blip, a sleep/wake, a
       * redeploy — with an expired token, the handshake was rejected, and
       * socket.io does NOT retry a namespace middleware rejection: realtime was
       * dead for the rest of the session with nothing on screen to say so.
       */
      auth: (callback) => {
        const token = getAccessToken();
        if (token) return callback({ token });

        refreshSession()
          .then((fresh) => callback({ token: fresh }))
          .catch(() => callback({}));
      },
    });

    instance.on("connect", () => {
      retriedAfterRefresh = false;
      setConnected(true);
    });
    instance.on("disconnect", () => setConnected(false));

    instance.on("connect_error", async (error) => {
      logSocketError(error);
      setConnected(false);

      if (error?.message !== "Authentication required" || retriedAfterRefresh) return;
      retriedAfterRefresh = true;

      // A middleware rejection stops socket.io's own retry loop for good
      // (socket.active goes false), so reconnecting has to be done by hand
      // after getting a fresh token.
      try {
        await refreshSession();
        if (!disposed) instance.connect();
      } catch {
        // The session is genuinely over; AuthContext will drop to signed-out.
      }
    });

    setSocket(instance);

    return () => {
      disposed = true;
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
