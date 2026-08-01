import { getStoredRefreshToken } from "../utils/authStorage.js";
import apiClient from "./client.js";

export const register = (credentials) =>
  apiClient.post("/auth/register", credentials);

export const login = (credentials) => apiClient.post("/auth/login", credentials);

// Sends the token explicitly, because when the cross-site cookie is blocked the
// server had nothing to revoke — "Log out" cleared the tab while the refresh
// token stayed valid for its full 30-day life.
export const logout = () =>
  apiClient.post("/auth/logout", { refreshToken: getStoredRefreshToken() ?? undefined });
