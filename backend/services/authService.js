import jwt from "jsonwebtoken";
import config from "../config/environment.js";
import User from "../models/user.js";
import AppError from "../utils/AppError.js";
import { hashPassword, matchPassword } from "../utils/passwordUtils.js";

export const issueAccessToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

/**
 * The only user shape that ever leaves the auth layer — never includes the hash.
 *
 * Must carry every field the client branches on. Omitting onboardedAt, consent
 * and preferences caused four separate failures: onboarding was forced on every
 * login (needsOnboarding read a field that was never sent), the daily check-in
 * card never rendered, and Settings displayed consent as OFF while it was ON —
 * telling users their health data was not being stored while it was.
 */
const toPublicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  onboardedAt: user.onboardedAt ?? null,
  preferences: user.preferences ?? [],
  timeZone: user.timeZone ?? "UTC",
  consent: {
    moodTracking: user.consent?.moodTracking ?? false,
    grantedAt: user.consent?.grantedAt ?? null,
  },
});

/** Only accept a timezone the platform recognises; anything else is UTC. */
const safeTimeZone = (timeZone) => {
  if (!timeZone || typeof timeZone !== "string") return "UTC";

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
};

export const registerUser = async ({ name, email, password, timeZone }) => {
  const normalizedEmail = email.toLowerCase().trim();

  if (await User.exists({ email: normalizedEmail })) {
    throw AppError.conflict("An account with that email already exists");
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password: await hashPassword(password),
    timeZone: safeTimeZone(timeZone),
  });

  return { user: toPublicUser(user) };
};

/**
 * Signs in the owner of a Spotify account, creating a ZENOVA account the first
 * time.
 *
 * Matching is on the Spotify user id, never on the email alone. Auto-linking by
 * email would be a pre-hijacking hole: ZENOVA does not verify addresses at
 * registration, so anyone could register with someone else's address and wait
 * for the real owner to sign in with Spotify and be handed the attacker's
 * account. An existing password account therefore has to be claimed from the
 * inside — sign in with the password, then connect Spotify from Settings.
 */
export const findOrCreateSpotifyUser = async ({ spotifyId, email, displayName }) => {
  if (!spotifyId) throw AppError.badRequest("Spotify did not return an account id");

  const existing = await User.findOne({ spotifyId });
  if (existing) return { user: toPublicUser(existing), created: false };

  const normalizedEmail = email?.toLowerCase().trim();
  if (!normalizedEmail) {
    throw AppError.badRequest(
      "Spotify did not share an email address, so an account cannot be created"
    );
  }

  const emailTaken = await User.findOne({ email: normalizedEmail });
  if (emailTaken) {
    throw AppError.conflict(
      "An account already uses that email. Sign in with your password, then connect Spotify from Settings."
    );
  }

  const user = await User.create({
    name: displayName?.trim() || normalizedEmail.split("@")[0],
    email: normalizedEmail,
    spotifyId,
  });

  return { user: toPublicUser(user), created: true };
};

/**
 * Attaches a Spotify account to the signed-in user, so they can sign in with
 * either from then on.
 */
export const linkSpotifyAccount = async ({ userId, spotifyId }) => {
  const claimedBy = await User.findOne({ spotifyId });

  if (claimedBy && claimedBy._id.toString() !== userId.toString()) {
    throw AppError.conflict("That Spotify account is already linked to another user");
  }

  const user = await User.findByIdAndUpdate(userId, { spotifyId }, { new: true });
  if (!user) throw AppError.notFound("User not found");

  return { user: toPublicUser(user) };
};

export const authenticateUser = async ({ email, password }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    "+password"
  );

  // Same message for unknown email and wrong password, so the response cannot
  // be used to enumerate registered addresses. An account that signs in with
  // Spotify has no password to compare, and falls into the same branch.
  const invalid = AppError.unauthorized("Invalid credentials");
  if (!user?.password) throw invalid;
  if (!(await matchPassword(password, user.password))) throw invalid;

  return { user: toPublicUser(user) };
};

export { toPublicUser };
