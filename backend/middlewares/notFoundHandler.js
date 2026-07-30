import AppError from "../utils/AppError.js";

const notFoundHandler = (req, res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default notFoundHandler;
