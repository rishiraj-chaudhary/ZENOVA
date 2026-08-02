import crypto from "crypto";
import { establishSession } from "../services/authSessionService.js";
import {
  findOrCreateSpotifyUser,
  linkSpotifyAccount,
} from "../services/authService.js";
import { generateRecommendations } from "../services/recommendationService.js";
import { syncListeningHistory } from "../services/listeningStreamService.js";
import {
  explorationTemperature,
  derivePersona,
  getPersona,
  peakListeningHour,
} from "../services/personaService.js";
import {
  buildAuthorizeUrl,
  buildEmbedUrl,
  exchangeAuthorizationCode,
  fetchDevices,
  fetchSpotifyProfile,
  refreshUserToken,
  startPlayback,
} from "../services/spotifyService.js";
import AppError from "../utils/AppError.js";
import asyncHandler from "../utils/asyncHandler.js";
import resolveRegion from "../utils/resolveRegion.js";

export const getMusicRecommendations = asyncHandler(async (req, res) => {
  const { message, conversationHistory } = req.body;

  const result = await generateRecommendations({
    userId: req.user._id,
    message,
    conversationHistory,
    region: resolveRegion(req),
    timeZone: req.user?.timeZone,
  });

  res.json(result);
});

export const getSpotifyEmbed = asyncHandler(async (req, res) => {
  res.json({ embedUrl: buildEmbedUrl(req.params.trackId) });
});

/**
 * Starts the Spotify OAuth flow.
 *
 * `intent` decides what the callback does with the result: "login" signs the
 * person into ZENOVA (creating an account the first time), "connect" attaches
 * Spotify to the account they are already signed into. It is recorded in the
 * session rather than taken from the callback's query string, so the redirect
 * cannot be re-pointed at a different outcome than the one that was started.
 */
export const getSpotifyAuthUrl = asyncHandler(async (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  req.session.spotifyAuthState = state;
  req.session.spotifyAuthIntent = req.query.intent === "login" ? "login" : "connect";

  res.json({ authUrl: buildAuthorizeUrl(state) });
});

export const handleSpotifyCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  if (!code) throw AppError.badRequest("Missing authorization code");

  // Fails closed. Enforcing only "when a state was issued" made the check
  // worthless: an attacker just has to get the victim to the callback without a
  // session, and since the state was also deleted before the exchange, any
  // retry arrived with none. Both holes let an attacker's authorization code be
  // exchanged into the victim's browser.
  const expectedState = req.session?.spotifyAuthState;
  if (!expectedState || state !== expectedState) {
    throw AppError.badRequest("Invalid or missing OAuth state");
  }

  const tokens = await exchangeAuthorizationCode(code);
  const intent = req.session.spotifyAuthIntent ?? "connect";

  // Consumed only once the exchange succeeded, so a transient Spotify failure
  // leaves the user able to retry rather than permanently unable to connect.
  delete req.session.spotifyAuthState;
  delete req.session.spotifyAuthIntent;

  // Playback-only: hand back the tokens and leave ZENOVA's own session alone.
  if (intent !== "login" && !req.user) {
    return res.json(tokens);
  }

  const profile = await fetchSpotifyProfile(tokens.accessToken);

  // Already signed in — attach Spotify to this account rather than making a
  // second one. This is also the only way to put Spotify on an account that
  // was created with a password.
  if (req.user) {
    const { user } = await linkSpotifyAccount({
      userId: req.user._id,
      spotifyId: profile.spotifyId,
    });

    return res.json({ ...tokens, user, linked: true });
  }

  const { user, created } = await findOrCreateSpotifyUser(profile);
  const session = await establishSession(req, res, user);

  req.session.user = session.user;

  res.json({ ...tokens, ...session, created });
});

/**
 * Where this person can actually hear a full track right now.
 *
 * The ladder is Premium in-browser, then any other active device — a phone with
 * Spotify open counts, and works on a free account — then the 30-second
 * preview. Offering "play on your phone" before falling back to a preview is a
 * materially better free-tier experience than the preview alone.
 */
export const getPlaybackOptions = asyncHandler(async (req, res) => {
  const accessToken = req.headers["x-spotify-token"];
  if (!accessToken) return res.json({ connected: false, devices: [] });

  try {
    const [profile, devices] = await Promise.all([
      fetchSpotifyProfile(accessToken),
      fetchDevices(accessToken),
    ]);

    res.json({
      connected: true,
      premium: profile.product === "premium",
      devices: devices.map(({ id, name, type, is_active: isActive }) => ({
        id,
        name,
        type,
        isActive,
      })),
    });
  } catch {
    res.json({ connected: false, devices: [] });
  }
});

export const playOnDevice = asyncHandler(async (req, res) => {
  const accessToken = req.headers["x-spotify-token"];
  if (!accessToken) throw AppError.badRequest("Connect Spotify first");

  const { deviceId, uris } = req.body;
  res.json(await startPlayback(accessToken, { deviceId, uris }));
});

/** Pulls this user's recent plays now, rather than waiting for the poller. */
export const syncListening = asyncHandler(async (req, res) => {
  const accessToken = req.headers["x-spotify-token"];
  if (!accessToken) throw AppError.badRequest("Connect Spotify first");

  const result = await syncListeningHistory(req.user, accessToken);
  const persona = result.synced > 0 ? await derivePersona(req.user._id) : await getPersona(req.user._id);

  res.json({ ...result, persona });
});

export const getMyPersona = asyncHandler(async (req, res) => {
  const persona = await getPersona(req.user._id);

  if (!persona) {
    return res.json({
      persona: null,
      message: "Connect Spotify and listen for a while — this builds from real history.",
    });
  }

  res.json({
    persona: {
      topGenres: persona.topGenres,
      topArtists: persona.topArtists,
      // Reported as what it drives, not as a claim about the person.
      adventurousness: persona.entropy,
      explorationTemperature: explorationTemperature(persona),
      tasteDrift: persona.tasteDrift,
      mainstreamIndex: persona.mainstreamIndex,
      peakHour: peakListeningHour(persona),
      basedOnPlays: persona.sampleSize,
      refreshedAt: persona.refreshedAt,
    },
  });
});

export const refreshSpotifyToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw AppError.badRequest("Missing refresh token");

  res.json(await refreshUserToken(refreshToken));
});
