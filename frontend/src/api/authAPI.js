import { getStoredRefreshToken } from "../utils/authStorage.js";
import apiClient from "./client.js";

/**
 * The browser's timezone travels with registration.
 *
 * Everything day-shaped depends on it — streaks roll over at the user's
 * midnight, and the hardest-hour statistic is about their day, not the
 * server's. Sent once here rather than guessed server-side from an IP.
 */
export const register = (credentials) =>
  apiClient.post("/auth/register", {
    ...credentials,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

export const login = (credentials) => apiClient.post("/auth/login", credentials);

// Sends the token explicitly, because when the cross-site cookie is blocked the
// server had nothing to revoke — "Log out" cleared the tab while the refresh
// token stayed valid for its full 30-day life.
export const logout = () =>
  apiClient.post("/auth/logout", { refreshToken: getStoredRefreshToken() ?? undefined });
