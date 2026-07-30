/**
 * Single source of truth for backend addresses.
 *
 * In production the API may be same-origin (served by Express) or a separate
 * host (Render, while the frontend is on Vercel). VITE_API_URL selects the
 * latter and is accepted either with or without the trailing /api, because both
 * forms are natural to write in a dashboard env var.
 */
const DEV_SERVER_ORIGIN = "http://localhost:3000";
const API_PREFIX = "/api";

const stripTrailingSlash = (url) => url.replace(/\/+$/, "");

/** Normalises "https://host", "https://host/", "https://host/api" → ".../api". */
const toApiBase = (url) => {
  const origin = stripTrailingSlash(url);
  return origin.endsWith(API_PREFIX) ? origin : `${origin}${API_PREFIX}`;
};

const explicitApiUrl = import.meta.env.VITE_API_URL?.trim();

export const API_BASE_URL = explicitApiUrl
  ? toApiBase(explicitApiUrl)
  : import.meta.env.PROD
    ? API_PREFIX
    : `${DEV_SERVER_ORIGIN}${API_PREFIX}`;

/** Socket.IO connects to the origin, never the /api path. */
export const SOCKET_URL = explicitApiUrl
  ? stripTrailingSlash(explicitApiUrl).replace(new RegExp(`${API_PREFIX}$`), "")
  : import.meta.env.PROD
    ? window.location.origin
    : DEV_SERVER_ORIGIN;

export default API_BASE_URL;
