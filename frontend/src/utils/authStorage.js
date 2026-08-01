const USER_ID_KEY = "userId";
const REFRESH_KEY = "zenova_refresh";

/**
 * A hint, in localStorage, that this browser probably has a live session.
 *
 * Not a credential — the refresh token itself stays in an httpOnly cookie the
 * page cannot read. It exists because the restore gate used to read only
 * sessionStorage, which is per-tab and cleared when the browser closes: the
 * 30-day refresh cookie was still perfectly valid but nothing ever tried to use
 * it, so every browser restart and every new tab looked like a signed-out user.
 */
const SESSION_HINT_KEY = "zenova_has_session";

/**
 * Access token lives in memory only.
 *
 * It was previously a 30-day JWT in sessionStorage, so any XSS meant a
 * month-long account takeover. In memory it dies with the tab, and it now
 * expires in 15 minutes, so the window an injected script could exploit is
 * bounded even while the page is open.
 */
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};

/**
 * The refresh token normally lives in an httpOnly cookie the page cannot read.
 * This mirror is only populated when the server had to fall back to returning
 * it in the body — see backend/utils/refreshCookie.js for why that path exists.
 */
export const getStoredRefreshToken = () => sessionStorage.getItem(REFRESH_KEY);

/** Advances the mirror after a rotation, without touching the rest of the session. */
export const storeRefreshToken = (refreshToken) =>
  sessionStorage.setItem(REFRESH_KEY, refreshToken);

export const storeAuth = ({ token, userId, refreshToken }) => {
  setAccessToken(token);
  if (userId) sessionStorage.setItem(USER_ID_KEY, userId);
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(SESSION_HINT_KEY, "1");
};

export const clearStoredAuth = () => {
  setAccessToken(null);
  sessionStorage.removeItem(USER_ID_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_HINT_KEY);
};

export const getStoredUserId = () => sessionStorage.getItem(USER_ID_KEY);

/**
 * Whether a session is worth attempting to restore.
 *
 * True even without an access token in memory: after a reload the token is
 * gone but the refresh cookie may still be valid, so the app should try to
 * refresh rather than assume the user is signed out.
 */
export const hasStoredAuth = () =>
  Boolean(
    accessToken ||
      getStoredUserId() ||
      getStoredRefreshToken() ||
      localStorage.getItem(SESSION_HINT_KEY)
  );
