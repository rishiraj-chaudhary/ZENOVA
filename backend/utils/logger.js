import config from "../config/environment.js";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[process.env.LOG_LEVEL] ?? (config.isProduction ? 2 : 3);

/**
 * Fields that must never reach a log line. Mood text is health data and tokens
 * are credentials; both were previously printed by bare console.log calls.
 */
const REDACTED_KEYS = new Set([
  "password", "token", "accessToken", "refreshToken", "authorization",
  "jwt", "secret", "apiKey", "mood", "context", "userInput", "message",
]);

const redact = (value, depth = 0) => {
  if (depth > 4 || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [
      key,
      REDACTED_KEYS.has(key) ? "[redacted]" : redact(val, depth + 1),
    ])
  );
};

/**
 * Metadata is expected to be a plain object. A string or Error passed by
 * mistake would otherwise be spread into indexed characters or dropped, so it
 * is normalised into a `detail` field instead.
 */
const toMeta = (meta) => {
  if (meta == null) return {};
  if (meta instanceof Error) return { detail: meta.message, stack: meta.stack };
  if (typeof meta !== "object" || Array.isArray(meta)) return { detail: meta };
  return meta;
};

/**
 * Emits one JSON object per line so logs are queryable by any aggregator.
 * Development stays human-readable.
 */
const emit = (level, message, rawMeta) => {
  if (LEVELS[level] > activeLevel) return;

  const meta = toMeta(rawMeta);

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...redact(meta),
  };

  const line = config.isProduction
    ? JSON.stringify(entry)
    : `${level.toUpperCase().padEnd(5)} ${message}${
        Object.keys(meta).length ? ` ${JSON.stringify(redact(meta))}` : ""
      }`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

const logger = {
  error: (message, meta) => emit("error", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  info: (message, meta) => emit("info", message, meta),
  debug: (message, meta) => emit("debug", message, meta),

  /** Scopes every line to one request so a trace can be reassembled. */
  child: (bindings) => ({
    error: (message, meta) => emit("error", message, { ...bindings, ...meta }),
    warn: (message, meta) => emit("warn", message, { ...bindings, ...meta }),
    info: (message, meta) => emit("info", message, { ...bindings, ...meta }),
    debug: (message, meta) => emit("debug", message, { ...bindings, ...meta }),
  }),
};

export default logger;
