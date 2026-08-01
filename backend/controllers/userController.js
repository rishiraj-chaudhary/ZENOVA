import User from "../models/user.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";

/** Prevents user input from being interpreted as a regular expression. */
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// req.user is already loaded and password-free by the auth middleware, so the
// profile endpoint needs no second database round-trip.
export const getUserProfile = asyncHandler(async (req, res) => {
  res.json(req.user);
});

const SEARCH_RESULT_LIMIT = 10;
const MIN_SEARCH_LENGTH = 2;

/**
 * Finds collaborators by partial name.
 *
 * Invites previously required typing another user's name exactly, which made
 * sharing effectively unusable. Only name is searchable and only name is
 * returned — email is never exposed, so this cannot be used to harvest addresses.
 */
export const searchUsers = asyncHandler(async (req, res) => {
  const query = req.query.q?.trim();

  if (!query || query.length < MIN_SEARCH_LENGTH) {
    return res.json({ users: [] });
  }

  const users = await User.find({
    name: { $regex: escapeRegex(query), $options: "i" },
    _id: { $ne: req.user._id },
  })
    .select("name")
    .limit(SEARCH_RESULT_LIMIT)
    .lean();

  res.json({ users });
});

/**
 * Records the user's decision about mood tracking. Withdrawing consent stops
 * future writes; existing history is removed separately via /api/privacy so the
 * two actions stay explicit and independent.
 */
export const updateConsent = asyncHandler(async (req, res) => {
  const { moodTracking } = req.body;

  const updated = await User.findByIdAndUpdate(
    req.user._id,
    {
      "consent.moodTracking": moodTracking,
      "consent.grantedAt": moodTracking ? new Date() : null,
    },
    { new: true }
  ).select("consent");

  if (!updated) throw AppError.notFound("User not found");

  res.json({ consent: updated.consent });
});

/**
 * Records the intro answers, exactly once.
 *
 * The update is conditional on onboardedAt being unset, so a replay cannot
 * overwrite settings the user has since changed. That mattered: the client was
 * re-showing this flow on every login with the consent box pre-ticked, so a
 * replay silently re-granted mood-tracking consent that had been withdrawn in
 * Settings — reversing a GDPR Art. 9 decision through a dialog with no dismiss.
 */
export const completeOnboarding = asyncHandler(async (req, res) => {
  const { preferences = [], moodTrackingConsent = false } = req.body;
  const now = new Date();

  const updated = await User.findOneAndUpdate(
    { _id: req.user._id, onboardedAt: null },
    {
      preferences,
      onboardedAt: now,
      "consent.moodTracking": moodTrackingConsent,
      "consent.grantedAt": moodTrackingConsent ? now : null,
    },
    { new: true, runValidators: true }
  ).select("-password");

  // No match means onboarding was already completed. Return the current
  // profile rather than an error: the client only needs to stop showing it.
  if (!updated) {
    const existing = await User.findById(req.user._id).select("-password");
    if (!existing) throw AppError.notFound("User not found");
    return res.json(existing);
  }

  res.json(updated);
});

export const updatePreferences = asyncHandler(async (req, res) => {
  const updated = await User.findByIdAndUpdate(
    req.user._id,
    { preferences: req.body.preferences },
    { new: true, runValidators: true }
  ).select("preferences");

  if (!updated) throw AppError.notFound("User not found");

  res.json({
    message: "Preferences updated successfully",
    preferences: updated.preferences,
  });
});
