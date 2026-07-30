import rateLimit from "express-rate-limit";
import config from "./environment.js";

const ONE_MINUTE = 60 * 1000;

const buildLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    message: { success: false, message },
    standardHeaders: true,
    legacyHeaders: false,
    // Rate limiting exists to protect production quotas; leaving it on in
    // development makes local testing needlessly painful.
    skip: () => config.isDevelopment,
  });

/** Credential endpoints — tight, to blunt brute-force attempts. */
export const authLimiter = buildLimiter({
  windowMs: 15 * ONE_MINUTE,
  max: 10,
  message: "Too many authentication attempts. Please try again in 15 minutes.",
});

/** Gemini/Spotify-backed endpoints — each request costs real money. */
export const aiLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: 15,
  message: "Too many AI requests. Please slow down.",
});

/** Everything else. */
export const generalLimiter = buildLimiter({
  windowMs: ONE_MINUTE,
  max: 200,
  message: "Too many requests. Please try again shortly.",
});

const STATIC_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

const isAllowedOrigin = (origin) =>
  STATIC_ALLOWED_ORIGINS.includes(origin) ||
  origin === config.frontendUrl ||
  /\.railway\.app$/.test(origin) ||
  /\.netlify\.app$/.test(origin);

/**
 * Shared by the Express app and the Socket.IO server so both accept exactly the
 * same set of origins.
 */
export const corsOptions = {
  origin(origin, callback) {
    // Same-origin requests, curl and native clients send no Origin header.
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
