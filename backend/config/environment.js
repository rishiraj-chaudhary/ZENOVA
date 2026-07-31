import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

/**
 * Variables without a safe default. Missing any of them means the server would
 * boot and then fail at the first request that needs it, so we fail at startup
 * instead. In development we only warn, to keep partial setups runnable.
 */
const REQUIRED_IN_PRODUCTION = [
  "MONGO_URI",
  "JWT_SECRET",
  "SESSION_SECRET",
  "FRONTEND_URL",
];

const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);

if (missing.length > 0) {
  const message = `Missing required environment variables: ${missing.join(", ")}`;
  if (isProduction) throw new Error(message);
  console.warn(`[config] ${message} — using development defaults`);
}

const parsePort = (value, fallback) => {
  const port = Number.parseInt(value ?? "", 10);
  return Number.isInteger(port) && port > 0 ? port : fallback;
};

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

const config = {
  isProduction,
  isDevelopment: !isProduction,
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT, 3000),

  frontendUrl,

  mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/therapy",

  jwt: {
    secret: process.env.JWT_SECRET ?? "development-only-jwt-secret",
    // Short-lived by design: the access token is the credential an XSS can
    // steal, so its useful life is minutes rather than the previous 30 days.
    // Sessions stay long-lived through the rotating refresh token instead.
    expiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  },

  session: {
    secret: process.env.SESSION_SECRET ?? "development-only-session-secret",
    maxAgeMs: 24 * 60 * 60 * 1000,
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  },

  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI ?? `${frontendUrl}/spotify-callback`,
  },
};

if (isProduction) {
  const weakSecrets = ["jwt", "session"].filter((key) =>
    config[key].secret.startsWith("development-only")
  );
  if (weakSecrets.length > 0) {
    throw new Error(
      `Refusing to start in production with default ${weakSecrets.join(" and ")} secret(s)`
    );
  }
}

export default config;
