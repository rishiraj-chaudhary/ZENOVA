import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as musicAPI from "../api/musicAPI.js";

const STORAGE_KEY = "spotify_session";
const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";
const PLAYER_NAME = "Zenova Music Therapy Player";

export const SpotifyAuthContext = createContext(null);

/**
 * The three token fields are always written and cleared together, so they are
 * stored as one record instead of three independent localStorage keys that
 * could drift out of sync.
 */
const readStoredSession = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
};

const writeStoredSession = (session) => {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
};

const toSession = ({ accessToken, refreshToken, expiresIn }, previous) => ({
  accessToken,
  refreshToken: refreshToken ?? previous?.refreshToken ?? null,
  expiresAt: Date.now() + expiresIn * 1000,
});

const isValid = (session) => Boolean(session && Date.now() < session.expiresAt);

export const SpotifyAuthProvider = ({ children }) => {
  const [session, setSession] = useState(readStoredSession);
  const [player, setPlayer] = useState(null);
  const playerRef = useRef(null);

  const isAuthenticated = isValid(session);

  const persist = useCallback((next) => {
    writeStoredSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    setPlayer(null);
    persist(null);
    localStorage.removeItem("spotify_device_id");
  }, [persist]);

  const refreshAccessToken = useCallback(async () => {
    if (!session?.refreshToken) return;

    try {
      const tokens = await musicAPI.refreshSpotifyToken(session.refreshToken);
      persist(toSession(tokens, session));
    } catch (error) {
      console.error("Failed to refresh Spotify token:", error.message);
      logout();
    }
  }, [session, persist, logout]);

  // Renews a stored-but-expired token once on load.
  useEffect(() => {
    if (session && !isValid(session) && session.refreshToken) {
      refreshAccessToken();
    }
  }, [session, refreshAccessToken]);

  /**
   * Sends the browser to Spotify.
   *
   * "connect" adds playback to an existing ZENOVA account; "login" signs the
   * person in with Spotify, creating a ZENOVA account the first time. The
   * button on the signed-out login page used to start the "connect" flow, which
   * stored tokens and then dropped the user back on /login with no account.
   */
  const login = useCallback(async (intent = "connect") => {
    try {
      const { authUrl } = await musicAPI.fetchSpotifyAuthUrl(intent);
      window.location.href = authUrl;
    } catch (error) {
      console.error("Failed to start Spotify login:", error.message);
    }
  }, []);

  /**
   * Completes the exchange and returns whatever the server decided the flow
   * was: `user`/`refreshToken` when it signed someone in, `linked` when it
   * attached Spotify to the current account, neither for playback-only.
   */
  const handleCallback = useCallback(
    async (code, state) => {
      try {
        const result = await musicAPI.exchangeSpotifyCode({ code, state });
        persist(toSession(result));
        return { ok: true, ...result };
      } catch (error) {
        console.error("Spotify callback failed:", error.message);
        return { ok: false, message: error.message };
      }
    },
    [persist]
  );

  /**
   * Loads the Web Playback SDK once per authenticated session and tears the
   * player down on cleanup. The previous version dropped the disconnect
   * function returned by its initializer, so every token refresh left an
   * orphaned player connected.
   */
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      if (!window.Spotify) return;

      const instance = new window.Spotify.Player({
        name: PLAYER_NAME,
        getOAuthToken: (callback) => callback(session.accessToken),
        volume: 0.5,
      });

      instance.addListener("authentication_error", () => refreshAccessToken());
      ["initialization_error", "account_error", "playback_error"].forEach((event) =>
        instance.addListener(event, ({ message }) =>
          console.error(`Spotify ${event}:`, message)
        )
      );

      instance.addListener("ready", ({ device_id: deviceId }) =>
        localStorage.setItem("spotify_device_id", deviceId)
      );
      instance.addListener("not_ready", () =>
        localStorage.removeItem("spotify_device_id")
      );

      instance.connect();
      playerRef.current = instance;
      setPlayer(instance);
    };

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setPlayer(null);
      script.remove();
      delete window.onSpotifyWebPlaybackSDKReady;
    };
    // Re-running on every token refresh would needlessly reload the SDK; the
    // player reads the current token through the getOAuthToken callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo(
    () => ({
      accessToken: session?.accessToken ?? null,
      isAuthenticated,
      player,
      login,
      logout,
      handleCallback,
      refreshAccessToken,
    }),
    [session, isAuthenticated, player, login, logout, handleCallback, refreshAccessToken]
  );

  return (
    <SpotifyAuthContext.Provider value={value}>{children}</SpotifyAuthContext.Provider>
  );
};

export const useSpotifyAuth = () => {
  const context = useContext(SpotifyAuthContext);
  if (!context) {
    throw new Error("useSpotifyAuth must be used within a SpotifyAuthProvider");
  }
  return context;
};

export default SpotifyAuthContext;
