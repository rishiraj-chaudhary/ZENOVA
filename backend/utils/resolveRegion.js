/**
 * Country hint used to pick region-appropriate helplines.
 *
 * Read from an explicit query parameter, then the Accept-Language header's
 * country subtag ("en-IN" -> "IN"). Returns null when neither is usable, which
 * falls back to the international registry.
 *
 * Lives here because every crisis surface needs it: without it the
 * recommendation path emitted the international entry only, so a user in acute
 * distress saw a website and never a phone number.
 */
const resolveRegion = (req) => {
  const explicit = req.query?.region;
  if (explicit) return explicit.toUpperCase();

  const country = req.headers?.["accept-language"]?.split(",")[0]?.split("-")[1];
  return country ? country.toUpperCase() : null;
};

export default resolveRegion;
