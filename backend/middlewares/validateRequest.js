import { validationResult } from "express-validator";
import AppError from "../utils/AppError.js";

/**
 * Runs after express-validator rules and turns any collected failures into a
 * single 400. Keeps controllers free of `validationResult` boilerplate.
 */
const validateRequest = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  next(
    AppError.badRequest(
      "Validation failed",
      result.array().map(({ path, msg }) => ({ field: path, message: msg }))
    )
  );
};

export default validateRequest;
