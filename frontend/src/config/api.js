/**
 * Single source of truth for backend addresses.
 *
 * In production the API is served from the same origin as the app, so a
 * relative base keeps the build portable across deploy targets. VITE_API_URL
 * overrides both when the API lives elsewhere.
 */
const DEV_SERVER_ORIGIN = "http://localhost:3000";

const explicitApiUrl = import.meta.env.VITE_API_URL;

export const API_BASE_URL =
  explicitApiUrl ?? (import.meta.env.PROD ? "/api" : `${DEV_SERVER_ORIGIN}/api`);

export const SOCKET_URL =
  explicitApiUrl?.replace(/\/api\/?$/, "") ??
  (import.meta.env.PROD ? window.location.origin : DEV_SERVER_ORIGIN);

export default API_BASE_URL;
