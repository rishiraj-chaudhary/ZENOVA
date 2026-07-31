import axios from "axios";
import querystring from "querystring";
import SpotifyWebApi from "spotify-web-api-node";
import config from "../config/environment.js";
import AppError from "../utils/AppError.js";
import logger from "../utils/logger.js";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const AUTHORIZE_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

const USER_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
  "user-library-read",
  "playlist-read-private",
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
