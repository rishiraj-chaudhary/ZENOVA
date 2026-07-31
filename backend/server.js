import compression from "compression";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import session from "express-session";
import helmet from "helmet";
import http from "http";
import mongoose from "mongoose";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

import connectDB from "./config/database.js";
import config from "./config/environment.js";
import { corsOptions, generalLimiter } from "./config/security.js";
import errorHandler from "./middlewares/errorHandler.js";
import notFoundHandler from "./middlewares/notFoundHandler.js";
import requestLogger from "./middlewares/requestLogger.js";
import { initializeDefaultBadges } from "./services/badgeService.js";
import SocketManager from "./services/socketManager.js";
import { getLlmMetrics, startMetricsReporter } from "./utils/llmMetrics.js";
import logger from "./utils/logger.js";

import authRoutes from "./routes/authRoutes.js";
import gamificationRoutes from "./routes/gamificationRoutes.js";
import geminiRoutes from "./routes/geminiRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import musicRoutes from "./routes/musicRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import privacyRoutes from "./routes/privacyRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import wellbeingRoutes from "./routes/wellbeingRoutes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });
const socketManager = new SocketManager(io);

/**
 * Registers middleware and routes.
 *
 * Called after the database is connected, because the session store is built
 * from the existing mongoose client. Creating it at module load opened a second
 * connection whose failure escaped the startup error handling and surfaced as
 * an opaque unhandled rejection.
 */
const configureApp = () => {
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(requestLogger);

  app.use(
    session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      // Reuses the connection opened by connectDB rather than dialling again.
      store: MongoStore.create({
        client: mongoose.connection.getClient(),
        collectionName: "sessions",
        ttl: config.session.maxAgeMs / 1000,
      }),
      cookie: {
        httpOnly: true,
        // The frontend (Vercel) and API (Render) are on different origins in
        // production, so the session cookie must be cross-site. Browsers only
        // accept SameSite=None together with Secure.
        sameSite: config.isProduction ? "none" : "lax",
        secure: config.isProduction,
        maxAge: config.session.maxAgeMs,
      },
    })
  );

  app.use((req, res, next) => {
    req.socketManager = socketManager;
    req.io = io;
    next();
  });

  // Operational metrics for the Gemini integration: cost, latency and failure
  // rates per operation. Previously none of these were observable.
  app.get("/api/health/llm", (req, res) => {
    res.json(getLlmMetrics());
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
  });

  app.use("/api", generalLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/music/recommend", musicRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/gemini", geminiRoutes);
  app.use("/api/playlists", playlistRoutes);
  app.use("/api/gamification", gamificationRoutes);
  app.use("/api/leaderboard", leaderboardRoutes);
  app.use("/api/wellbeing", wellbeingRoutes);
  app.use("/api/privacy", privacyRoutes);

  app.use("/api", notFoundHandler);

  if (config.isProduction) {
    app.use(express.static(FRONTEND_DIST));
    app.get("*", (req, res) => {
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    });
  } else {
    app.get("/", (req, res) => {
      res.json({
        message: "ZENOVA API",
        environment: config.nodeEnv,
        frontend: config.frontendUrl,
      });
    });
  }

  app.use(errorHandler);
};

/**
 * Turns a startup failure into something actionable.
 *
 * A bare MongoServerSelectionError says only that a socket was refused, which
 * is the least useful part of the problem.
 */
const explainStartupFailure = (error) => {
  const isConnectionRefused =
    error.name === "MongoServerSelectionError" ||
    /ECONNREFUSED|ENOTFOUND|querySrv/.test(error.message);

  if (!isConnectionRefused) return null;

  const target = config.mongoUri.replace(/\/\/[^@]*@/, "//<credentials>@");
  const isLocal = /127\.0\.0\.1|localhost/.test(config.mongoUri);

  return [
    `Could not reach MongoDB at ${target}`,
    "",
    isLocal
      ? "No local MongoDB is accepting connections. Either start one:\n" +
        "  brew services start mongodb-community\n" +
        "or point MONGO_URI at a hosted cluster in backend/.env"
      : "The cluster refused the connection. Check MONGO_URI, that the cluster is\n" +
        "running, and that this machine's IP is allowed in the Atlas Network Access list.",
  ].join("\n");
};

const start = async () => {
  await connectDB();
  configureApp();
  await initializeDefaultBadges();
  startMetricsReporter();

  server.listen(config.port, () => {
    logger.info("server started", {
      port: config.port,
      environment: config.nodeEnv,
      frontendUrl: config.frontendUrl,
    });
  });
};

/**
 * An unhandled rejection leaves the process in an unknown state; log it and
 * exit so the supervisor restarts cleanly rather than serving from a broken one.
 */
process.on("unhandledRejection", (reason) => {
  logger.error("unhandled rejection", { reason: String(reason) });
  server.close(() => process.exit(1));
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  server.close(() => process.exit(0));
});

start().catch((error) => {
  const explanation = explainStartupFailure(error);

  if (explanation) {
    console.error(`\n${explanation}\n`);
  } else {
    logger.error("failed to start server", { error: error.message, stack: error.stack });
  }

  process.exit(1);
});

export default app;
