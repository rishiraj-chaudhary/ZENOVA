import express from "express";
import session from "express-session";
import { corsOptions } from "../../config/security.js";
import errorHandler from "../../middlewares/errorHandler.js";
import notFoundHandler from "../../middlewares/notFoundHandler.js";

import authRoutes from "../../routes/authRoutes.js";
import gamificationRoutes from "../../routes/gamificationRoutes.js";
import leaderboardRoutes from "../../routes/leaderboardRoutes.js";
import playlistRoutes from "../../routes/playlistRoutes.js";
import privacyRoutes from "../../routes/privacyRoutes.js";
import userRoutes from "../../routes/userRoutes.js";
import wellbeingRoutes from "../../routes/wellbeingRoutes.js";

/**
 * The production route stack without the network listener, Socket.IO or the
 * Mongo-backed session store, so tests exercise the same middleware and
 * validation the real server uses.
 */
export const buildTestApp = () => {
  const app = express();

  app.use(express.json());
  app.use(
    session({ secret: "test", resave: false, saveUninitialized: false })
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/playlists", playlistRoutes);
  app.use("/api/gamification", gamificationRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/wellbeing", wellbeingRoutes);
  app.use("/api/privacy", privacyRoutes);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
};

export { corsOptions };
