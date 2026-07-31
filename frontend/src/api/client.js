import axios from "axios";
import { API_BASE_URL } from "../config/api.js";
import {
  clearStoredAuth,
  getAccessToken,
  getStoredRefreshToken,
  setAccessToken,
} from "../utils/authStorage.js";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Normalises failures so callers always see an Error with a readable `message`
 * and the HTTP `status`, whether the backend replied, the network failed, or
 * the request was cancelled.
 */
const toApiError = (error) => {
  const apiError = new Error(
    error.response?.data?.message ??
      (error.request ? "Could not reach the server" : error.message)
  );
  apiError.status = error.response?.status;
  apiError.details = error.response?.data?.details;
  return apiError;
};

/** Callers notified when the session ends, so the app can redirect once. */
const sessionEndedHandlers = new Set();
export const onSessionEnded = (handler) => {
  sessionEndedHandlers.add(handler);
  return () => sessionEndedHandlers.delete(handler);
};

const endSession = () => {
  clearStoredAuth();
  sessionEndedHandlers.forEach((handler) => handler());
};

/**
 * A single in-flight refresh shared by every request that hits a 401 at once.
 *
 * Without this, N concurrent requests would each rotate the refresh token, and
 * because rotation is single-use all but one would be rejected as reuse — which
 * revokes the whole token family and logs the user out.
 */
let refreshInFlight = null;

const refreshSession = async () => {
  refreshInFlight ??= axios
    .post(
      `${API_BASE_URL}/auth/refresh`,
      // Sent only as the fallback for browsers that drop the cross-site cookie.
      { refreshToken: getStoredRefreshToken() ?? undefined },
      { withCredentials: true }
    )
    .then(({ data }) => {
      setAccessToken(data.user.token);
      return data.user.token;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

const isRefreshRequest = (config) => config?.url?.includes("/auth/refresh");

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const { config, response } = error;

    // Retry once after a refresh. The flag stops a failed retry looping.
    if (response?.status === 401 && config && !config._retried && !isRefreshRequest(config)) {
      config._retried = true;

      try {
        const token = await refreshSession();
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient.request(config);
      } catch {
        endSession();
      }
    } else if (response?.status === 401) {
      endSession();
    }

    return Promise.reject(toApiError(error));
  }
);

export { refreshSession };
export default apiClient;
