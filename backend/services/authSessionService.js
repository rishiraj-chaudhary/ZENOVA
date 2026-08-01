import { issueAccessToken } from "./authService.js";
import { issueRefreshToken } from "./refreshTokenService.js";
import { setRefreshCookie } from "../utils/refreshCookie.js";

/**
 * Issues the credential pair that represents a signed-in user.
 *
 * Extracted from authController so the Spotify sign-in callback can establish a
 * session the same way the password path does, rather than growing a second,
 * subtly different implementation of "you are now logged in".
 *
 * The refresh token goes into an httpOnly cookie and is also returned in the
 * body, because Safari and other browsers blocking third-party cookies drop the
 * cross-site cookie entirely — see utils/refreshCookie.js.
 */
export const establishSession = async (req, res, user) => {
  const refreshToken = await issueRefreshToken(user._id, {
    userAgent: req.headers["user-agent"],
  });

  setRefreshCookie(res, refreshToken);

  return {
    user: { ...user, token: issueAccessToken(user._id) },
    refreshToken,
  };
};

export default establishSession;
