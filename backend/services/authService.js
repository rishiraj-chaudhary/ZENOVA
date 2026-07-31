import jwt from "jsonwebtoken";
import config from "../config/environment.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";
import { hashPassword, matchPassword } from "../utils/passwordUtils.js";

export const issueAccessToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

/** The only user shape that ever leaves the auth layer — never includes the hash. */
const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
});

export const registerUser = async ({ name, email, password }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await User.exists({ email: normalizedEmail })) {
    throw AppError.conflict("An account with that email already exists");
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: await hashPassword(password),
  });

  return { user: toPublicUser(user) };
};

export const authenticateUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+password"
  );

  // Same message for unknown email and wrong password, so the response cannot
  // be used to enumerate registered addresses.
  const invalid = AppError.unauthorized("Invalid credentials");
  if (!user) throw invalid;
  if (!(await matchPassword(password, user.password))) throw invalid;

  return { user: toPublicUser(user) };
};

export { toPublicUser };
