export const POINTS = {
  PLAYLIST_CREATED: 10,
  SONG_ADDED: 5,
  PLAYLIST_SHARED: 15,
  DAILY_LOGIN: 5,
  STREAK_BONUS: 10, // per day of streak
  THERAPY_SESSION_COMPLETED: 25
};

export const LEVELS = [
  { level: 1, name: 'Beginner', minPoints: 0 },
  { level: 2, name: 'Explorer', minPoints: 40 },
  { level: 3, name: 'Curator', minPoints: 500 },
  { level: 4, name: 'Therapist', minPoints: 1500 },
  { level: 5, name: 'Master', minPoints: 5000 }
];
export const BADGES = [
  {
    name: 'First Steps',
    description: 'Created your first playlist',
    requirement: { type: 'playlist_count', value: 1 },
    category: 'creation',
    rarity: 'common',
    icon: 'fa-solid fa-star-of-david'
  },
  {
    name: 'Playlist Pro',
    description: 'Created 10 playlists',
    requirement: { type: 'playlist_count', value: 10 },
    category: 'creation',
    rarity: 'epic',
    icon: 'fa-solid fa-meteor' // ☄️
  },
  {
    name: 'Week Warrior',
    description: '7-day streak',
    requirement: { type: 'streak_days', value: 7 },
    category: 'streak',
    rarity: 'legendary',
    icon: 'fa-brands fa-old-republic' // 🛡️
  },
  {
    name: 'Month Master',
    description: '30-day streak',
    requirement: { type: 'streak_days', value: 30 },
    category: 'streak',
    rarity: 'rare',
    icon: 'fa-brands fa-jedi-order' // 🧘
  }
];

