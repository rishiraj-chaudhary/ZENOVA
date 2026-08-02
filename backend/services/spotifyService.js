import axios from "axios";
import querystring from "querystring";
import SpotifyWebApi from "spotify-web-api-node";
import config from "../config/environment.js";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

/**
 * What we ask Spotify for.
 *
 * `user-read-private` carries the `product` field, which is how Premium is
 * detected — and Premium is the difference between full playback and a
 * 30-second preview. `user-read-recently-played` is the one that compounds:
 * polled over weeks it becomes a listening history Spotify will not hand over
 * in a single call.
 */
const USER_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-top-read",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-modify-private",
];

const spotifyApi = new SpotifyWebApi({
  clientId: config.spotify.clientId,
  clientSecret: config.spotify.clientSecret,
  redirectUri: config.spotify.redirectUri,
});

let appTokenExpiresAt = 0;
let pendingTokenRequest = null;

/**
 * Client-credentials token used for catalogue search. Acquired lazily and
 * refreshed only when expired — the previous timer-chain approach fired on
 * module import (breaking any process that merely imported this file) and kept
 * refreshing forever even while completely idle.
 *
 * Concurrent callers share one in-flight request so a burst of recommendations
 * cannot trigger a burst of token requests.
 */
const ensureAppToken = async () => {
  if (Date.now() < appTokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) return;
  if (pendingTokenRequest) return pendingTokenRequest;

  pendingTokenRequest = spotifyApi
    .clientCredentialsGrant()
    .then(({ body }) => {
      spotifyApi.setAccessToken(body.access_token);
      appTokenExpiresAt = Date.now() + body.expires_in * 1000;
    })
    .finally(() => {
      pendingTokenRequest = null;
    });

  return pendingTokenRequest;
};

const toTrackSummary = (track) => ({
  spotifyId: track.id,
  spotifyUri: track.uri,
  spotifyUrl: track.external_urls.spotify,
  previewUrl: track.preview_url,
  albumArt: track.album.images[0]?.url ?? null,
  popularity: track.popularity,
  explicit: track.explicit,
});

const matchesTitleAndArtist = (track, title, artist) =>
  track.name.toLowerCase().includes(title.toLowerCase()) &&
  track.artists.some((a) => a.name.toLowerCase().includes(artist.toLowerCase()));

/** Progressively looser queries, so an exact match wins when one exists. */
const buildSearchQueries = (title, artist) => [
  `track:"${title}" artist:"${artist}"`,
  `"${title}" "${artist}"`,
  `${title} ${artist}`,
  `${title.split(" ")[0]} ${artist}`,
];

/**
 * Resolves a song title/artist to a Spotify track. Returns null rather than
 * throwing: a missing track degrades to a YouTube search link, it is not a
 * request failure.
 */
export const findTrack = async (title, artist) => {
  if (!title || !artist) return null;

  try {
    await ensureAppToken();
  } catch (error) {
    logger.error("Spotify authentication failed:", error.message);
    return null;
  }

  for (const query of buildSearchQueries(title, artist)) {
    try {
      const { body } = await spotifyApi.searchTracks(query, { limit: 5 });
      const tracks = body.tracks.items;
      if (tracks.length === 0) continue;

      const bestMatch =
        tracks.find((track) => matchesTitleAndArtist(track, title, artist)) ?? tracks[0];
      return toTrackSummary(bestMatch);
    } catch (error) {
      logger.warn(`Spotify search failed for "${query}":`, error.message);
    }
  }

  return null;
};

export const buildEmbedUrl = (trackId) =>
  `https://open.spotify.com/embed/track/${trackId}`;

export const buildAuthorizeUrl = (state) =>
  `${AUTHORIZE_ENDPOINT}?${querystring.stringify({
    response_type: "code",
    client_id: config.spotify.clientId,
    scope: USER_SCOPES.join(" "),
    redirect_uri: config.spotify.redirectUri,
    state,
  })}`;

const basicAuthHeader = () =>
  "Basic " +
  Buffer.from(`${config.spotify.clientId}:${config.spotify.clientSecret}`).toString(
    "base64"
  );

const requestUserToken = async (payload) => {
  try {
    const { data } = await axios.post(TOKEN_ENDPOINT, querystring.stringify(payload), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
    });

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    logger.error("Spotify token request failed:", error.response?.data ?? error.message);
    throw AppError.badGateway("Failed to authenticate with Spotify");
  }
};

/** Exchanges an authorization code from the OAuth redirect for user tokens. */
export const exchangeAuthorizationCode = (code) =>
  requestUserToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.spotify.redirectUri,
  });

/** Renews an expired user access token. */
export const refreshUserToken = (refreshToken) =>
  requestUserToken({ grant_type: "refresh_token", refresh_token: refreshToken });

/**
 * The authenticated Spotify user behind an access token.
 *
 * This is what makes "Sign in with Spotify" a sign-in rather than a token
 * exchange: without it the callback had tokens but no idea whose they were.
 */
/** A user-token request, with Spotify's own rate limiting respected. */
const spotifyGet = async (path, accessToken, params = {}) => {
  try {
    const { data } = await axios.get(`https://api.spotify.com/v1${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      params,
      timeout: 8000,
    });
    return data;
  } catch (error) {
    // 429 carries Retry-After. Surfacing it lets the caller back off rather
    // than hammering and getting banned.
    if (error.response?.status === 429) {
      const retryAfter = Number(error.response.headers["retry-after"] ?? 5);
      throw Object.assign(new Error("Spotify rate limited"), { retryAfter });
    }
    throw error;
  }
};

/**
 * The user's recent plays.
 *
 * Only 50 items deep, but it is a stream: polled every half hour and
 * accumulated, it becomes a longitudinal record of what somebody reached for
 * unprompted — observational data with no recommendation in the loop, which is
 * exactly what the causal work needs and what a recommender cannot manufacture.
 */
export const fetchRecentlyPlayed = async (accessToken, { after } = {}) => {
  const data = await spotifyGet("/me/player/recently-played", accessToken, {
    limit: 50,
    ...(after ? { after } : {}),
  });

  return (data.items ?? []).map((item) => ({
    spotifyTrackId: item.track.id,
    title: item.track.name,
    artist: item.track.artists?.[0]?.name ?? null,
    artistIds: (item.track.artists ?? []).map((artist) => artist.id),
    popularity: item.track.popularity ?? null,
    releaseYear: Number.parseInt(item.track.album?.release_date?.slice(0, 4), 10) || null,
    durationMs: item.track.duration_ms ?? null,
    playedAt: new Date(item.played_at),
  }));
};

/**
 * Genres for a batch of artists.
 *
 * Batched to 50 and worth caching hard — an artist's genres essentially never
 * change, and this is the only place genre comes from now that the audio
 * endpoints are gone.
 */
const genreCache = new Map();

export const fetchArtistGenres = async (artistIds, accessToken) => {
  const unknown = [...new Set(artistIds)].filter((id) => id && !genreCache.has(id));

  for (let i = 0; i < unknown.length; i += 50) {
    const batch = unknown.slice(i, i + 50);
    try {
      const data = await spotifyGet("/artists", accessToken, { ids: batch.join(",") });
      for (const artist of data.artists ?? []) {
        genreCache.set(artist.id, artist.genres ?? []);
      }
    } catch (error) {
      logger.debug("artist genre lookup failed", { detail: error.message });
      for (const id of batch) genreCache.set(id, []);
    }
  }

  return Object.fromEntries(
    [...new Set(artistIds)].map((id) => [id, genreCache.get(id) ?? []])
  );
};

/** Devices Spotify can currently play on — including the user's phone. */
export const fetchDevices = async (accessToken) => {
  const data = await spotifyGet("/me/player/devices", accessToken);
  return data.devices ?? [];
};

/**
 * Starts playback on a device.
 *
 * Works for free accounts too, as long as something else is already active —
 * which is why "play on your phone" is offered before falling back to a
 * 30-second preview. That is a materially better free-tier experience than a
 * preview ladder alone.
 */
export const startPlayback = async (accessToken, { deviceId, uris }) => {
  await axios.put(
    "https://api.spotify.com/v1/me/player/play",
    { uris },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: deviceId ? { device_id: deviceId } : {},
      timeout: 8000,
    }
  );

  return { started: true };
};

/** What is playing right now, which is how a skip becomes observable. */
export const fetchPlaybackState = async (accessToken) => {
  const data = await spotifyGet("/me/player", accessToken);
  if (!data) return null;

  return {
    trackId: data.item?.id ?? null,
    progressMs: data.progress_ms ?? 0,
    durationMs: data.item?.duration_ms ?? null,
    isPlaying: Boolean(data.is_playing),
  };
};

export const fetchSpotifyProfile = async (accessToken) => {
  try {
    const { data } = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    return {
      spotifyId: data.id,
      email: data.email ?? null,
      displayName: data.display_name ?? null,
      avatarUrl: data.images?.[0]?.url ?? null,
      // "premium" | "free" | "open" — decides whether full playback is possible
      // at all, and therefore which rung of the playback ladder to offer.
      product: data.product ?? null,
      country: data.country ?? null,
    };
  } catch (error) {
    logger.error("Spotify profile request failed", {
      detail: error.response?.data ?? error.message,
    });
    throw AppError.badGateway("Could not read your Spotify profile");
  }
};
