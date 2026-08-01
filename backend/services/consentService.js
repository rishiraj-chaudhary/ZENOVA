import User from "../models/user.js";

/**
 * Whether this user has consented to mood tracking.
 *
 * Mood — self-reported or inferred — is special-category health data under GDPR
 * Art. 9 and sensitive personal data under India's DPDP Act. The gate belongs at
 * every write, not at the UI: the check used to live privately inside
 * moodService, so /wellbeing/sessions/start and /sessions/complete persisted
 * before/after ratings for users who had never consented, and the export handed
 * that data back as if it had been collected legitimately.
 */
export const hasMoodConsent = async (userId) => {
  if (!userId) return false;

  const user = await User.findById(userId).select("consent").lean();
  return Boolean(user?.consent?.moodTracking);
};

export default hasMoodConsent;
