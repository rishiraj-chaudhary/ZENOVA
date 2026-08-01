/**
 * The reward table.
 *
 * Re-pointed at measurement. Paying for volume — a point per song added, per
 * playlist created — paid users to generate events carrying no before/after
 * reading, which injects motivated noise into the SongEffect ledger that
 * recommendations now rank from. You cannot pay for an answer and then trust it.
 *
 * What earns points now is completing a measured session and checking in: the
 * behaviour that makes the product better rather than the behaviour that
 * dilutes it. Creating and sharing still earn a token amount, because they are
 * real use, but they no longer dominate and each is deduplicated per entity.
 */
export const POINTS = {
  /** A session rated before and after — the observation the ledger is built on. */
  SESSION_MEASURED: 30,
  /** A listening session completed without the after-rating. */
  THERAPY_SESSION_COMPLETED: 10,
  /** One mood check-in per calendar day. */
  DAILY_CHECK_IN: 15,
  DAILY_LOGIN: 5,

  // Real use, but not what the product should optimise for.
  PLAYLIST_CREATED: 5,
  PLAYLIST_SHARED: 5,
  SONG_ADDED: 2,
};

/**
 * Per-action daily ceilings, in POINTS not occurrences, so a burst of
 * legitimate-looking activity cannot outweigh sustained measured use. An action
 * absent here is uncapped.
 *
 * Each is expressed as (points per occurrence x intended daily occurrences).
 */
export const DAILY_POINT_CAPS = {
  SONG_ADDED: 2 * 5, // five songs
  PLAYLIST_CREATED: 5 * 3, // three playlists
  PLAYLIST_SHARED: 5 * 3, // three shares
};

export const LEVELS = [
  { level: 1, name: "Listener", minPoints: 0 },
  { level: 2, name: "Explorer", minPoints: 150 },
  { level: 3, name: "Curator", minPoints: 600 },
  // Renamed from "Therapist": awarding users that title contradicts the app's
  // own standing disclaimer that it is not therapy and not a medical service.
  { level: 4, name: "Attuned", minPoints: 1800 },
  { level: 5, name: "Master", minPoints: 5000 },
];

/**
 * Progress toward the next level, for the Achievements page.
 *
 * The bar previously had no source of truth for the thresholds and rendered a
 * value that did not move.
 */
export const getLevelProgress = (totalPoints) => {
  const current =
    [...LEVELS].reverse().find((entry) => totalPoints >= entry.minPoints) ?? LEVELS[0];
  const next = LEVELS.find((entry) => entry.level === current.level + 1) ?? null;

  if (!next) {
    return {
      level: current.level,
      levelName: current.name,
      nextLevelName: null,
      pointsIntoLevel: totalPoints - current.minPoints,
      pointsForNextLevel: null,
      fraction: 1,
    };
  }

  const span = next.minPoints - current.minPoints;
  const earned = totalPoints - current.minPoints;

  return {
    level: current.level,
    levelName: current.name,
    nextLevelName: next.name,
    pointsIntoLevel: earned,
    pointsForNextLevel: span,
    fraction: Math.min(Math.max(earned / span, 0), 1),
  };
};

/**
 * Badges reward measurement and consistency, matching what the points reward.
 * Every requirement type here must exist in badgeService's progress snapshot,
 * or the badge is unreachable.
 */
export const BADGES = [
  {
    name: "First Steps",
    description: "Created your first playlist",
    requirement: { type: "playlist_count", value: 1 },
    category: "creation",
    rarity: "common",
    icon: "fa-solid fa-star-of-david",
  },
  {
    name: "First Measure",
    description: "Rated your mood before and after a listening session",
    requirement: { type: "measured_sessions", value: 1 },
    category: "therapy",
    rarity: "common",
    icon: "fa-solid fa-heart-pulse",
  },
  {
    name: "Ten Readings",
    description: "Completed 10 measured sessions",
    requirement: { type: "measured_sessions", value: 10 },
    category: "therapy",
    rarity: "rare",
    icon: "fa-solid fa-chart-line",
  },
  {
    name: "Week Warrior",
    description: "7-day check-in streak",
    requirement: { type: "streak_days", value: 7 },
    category: "streak",
    rarity: "rare",
    icon: "fa-brands fa-old-republic",
  },
  {
    name: "Month Master",
    description: "30-day check-in streak",
    requirement: { type: "streak_days", value: 30 },
    category: "streak",
    rarity: "legendary",
    icon: "fa-brands fa-jedi-order",
  },
  {
    name: "Self Aware",
    description: "Logged 25 mood check-ins",
    requirement: { type: "check_in_days", value: 25 },
    category: "therapy",
    rarity: "rare",
    icon: "fa-solid fa-compass",
  },
  {
    name: "Playlist Pro",
    description: "Created 10 playlists",
    requirement: { type: "playlist_count", value: 10 },
    category: "creation",
    rarity: "epic",
    icon: "fa-solid fa-meteor",
  },
  {
    name: "Better Together",
    description: "Shared a playlist with someone",
    requirement: { type: "playlists_shared", value: 1 },
    category: "social",
    rarity: "common",
    icon: "fa-solid fa-user-group",
  },
];
