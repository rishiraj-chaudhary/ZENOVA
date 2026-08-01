const formatters = new Map();

/**
 * Calendar day as "YYYY-MM-DD" in a given zone.
 *
 * Streaks and once-per-day awards are calendar concepts, not durations. The
 * previous implementation divided elapsed milliseconds by 86,400,000, so
 * checking in at 23:00 and again at 08:00 the next morning scored as zero days
 * and did not advance the streak, while 08:00 to 07:00 two days later scored as
 * one and wrongly did.
 *
 * en-CA is used because it formats as YYYY-MM-DD, which sorts lexicographically.
 */
export const dayKey = (date = new Date(), timeZone = "UTC") => {
  if (!formatters.has(timeZone)) {
    formatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    );
  }

  return formatters.get(timeZone).format(date);
};

/**
 * Whole calendar days between two day keys.
 *
 * Operates on keys rather than instants, so daylight-saving transitions — which
 * make a calendar day 23 or 25 hours long — cannot skew the count.
 */
export const daysBetweenKeys = (laterKey, earlierKey) => {
  if (!laterKey || !earlierKey) return null;

  const toUtc = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };

  return Math.round((toUtc(laterKey) - toUtc(earlierKey)) / 86400000);
};

export default dayKey;
