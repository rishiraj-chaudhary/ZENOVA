const TRACK_ID_PATTERNS = [
  /spotify:track:([a-zA-Z0-9]+)/,
  /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
];

const BARE_TRACK_ID = /^[a-zA-Z0-9]{22}$/;

/**
 * Accepts a Spotify URI, an open.spotify.com URL, or a bare id and returns the
 * track id. Previously reimplemented in three components.
 */
export const extractSpotifyTrackId = (value) => {
  if (typeof value !== "string" || !value) return null;

  for (const pattern of TRACK_ID_PATTERNS) {
    const match = value.match(pattern);
    if (match) return match[1];
  }

  return BARE_TRACK_ID.test(value) ? value : null;
};

export default extractSpotifyTrackId;
