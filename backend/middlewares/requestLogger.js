import crypto from "crypto";
import logger from "../utils/logger.js";

const SLOW_REQUEST_MS = 2000;

/**
 * Assigns each request an id, exposes it on the response, and logs the outcome
 * once the response is finished. The id is what makes an error report traceable
 * back to the exact request that produced it.
 */
const requestLogger = (req, res, next) => {
  req.id = req.headers["x-request-id"] ?? crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader("X-Request-Id", req.id);

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    const meta = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: req.user?._id?.toString(),
    };

    if (res.statusCode >= 500) logger.error("request failed", { ...meta, requestId: req.id });
    else if (res.statusCode >= 400) logger.warn("request rejected", { ...meta, requestId: req.id });
    else if (durationMs > SLOW_REQUEST_MS) logger.warn("slow request", { ...meta, requestId: req.id });
    else logger.info("request", { ...meta, requestId: req.id });
  });

  next();
};

export default requestLogger;
