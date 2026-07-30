/**
 * An error the API deliberately raises and whose message is safe to show the
 * client. Anything thrown that is *not* an AppError is treated as a bug by the
 * error handler and reported as a generic 500.
 */
export default class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = "Not authorized") {
    return new AppError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new AppError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new AppError(404, message);
  }

  static conflict(message, details) {
    return new AppError(409, message, details);
  }

  static badGateway(message = "Upstream service failed") {
    return new AppError(502, message);
  }
}
