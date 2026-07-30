import mongoose from "mongoose";
import config from "../config/environment.js";
import AppError from "../utils/AppError.js";

/**
 * Translates known Mongoose/JWT failures into client-safe errors. Anything not
 * recognised here is treated as a bug and reported as a generic 500 so internal
 * details never reach the client.
 */
const toAppError = (err) => {
  if (err instanceof AppError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    return AppError.badRequest(
      "Validation failed",
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    );
  }

  if (err instanceof mongoose.Error.CastError) {
    return AppError.badRequest(`Invalid value for '${err.path}'`);
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? "field";
    return AppError.conflict(`A record with that ${field} already exists`);
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return AppError.unauthorized("Not authorized, token invalid");
  }

  return new AppError(err.statusCode ?? 500, "Internal Server Error");
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
const errorHandler = (err, req, res, next) => {
  const appError = toAppError(err);

  if (appError.statusCode >= 500) {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }

  res.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    ...(appError.details && { details: appError.details }),
    ...(config.isDevelopment && appError.statusCode >= 500 && { stack: err.stack }),
  });
};

export default errorHandler;
