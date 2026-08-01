import jwt from "jsonwebtoken";
import config from "../config/environment.js";
import User from "../models/user.js";
import logger from "../utils/logger.js";

/**
 * Socket.IO handshake authentication.
 *
 * Without this the server had no notion of who a socket was: every handler took
 * `userId` and `username` from the client payload, `register_user` joined
 * `user:<any id>` verbatim, and joining a playlist room performed no membership
 * check. Any anonymous socket could therefore subscribe to another person's
 * private notification room and emit destructive events as them.
 *
 * CORS is not a substitute — it is not a security boundary for WebSockets, and
 * the allowlist accepts any *.vercel.app origin.
 */
const readToken = (socket) => {
  const fromAuth = socket.handshake.auth?.token;
  if (fromAuth) return fromAuth;

  const header = socket.handshake.headers?.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
};

/**
 * Attaches the verified identity to the socket. Connections without a valid
 * token are rejected outright rather than downgraded to anonymous, because
 * every event this server handles is user-scoped.
 */
export const authenticateSocket = async (socket, next) => {
  try {
    const token = readToken(socket);
    if (!token) return next(new Error("Authentication required"));

    const { id } = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(id).select("name").lean();
    if (!user) return next(new Error("Authentication required"));

    // The only identity any handler may trust from here on.
    socket.data.userId = user._id.toString();
    socket.data.username = user.name;

    return next();
  } catch (error) {
    logger.warn("socket authentication failed", { detail: error.message });
    return next(new Error("Authentication required"));
  }
};

export default authenticateSocket;
