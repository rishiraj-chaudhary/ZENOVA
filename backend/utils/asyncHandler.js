/**
 * Wraps an async route handler so a rejected promise reaches the centralized
 * error handler instead of hanging the request.
 */
const asyncHandler = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

export default asyncHandler;
