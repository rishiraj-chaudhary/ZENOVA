import axios from "axios";
import { API_BASE_URL } from "../config/api.js";
import { clearStoredAuth, getStoredToken } from "../utils/authStorage.js";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Attaches the bearer token to every request, replacing the getAuthHeaders()
// helper that was redefined in five different components.
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Normalises failures so callers always see an Error with a readable `message`
 * and the HTTP `status`, whether the backend replied, the network failed, or
 * the request was cancelled.
 */
const toApiError = (error) => {
  const status = error.response?.status;
  const apiError = new Error(
    error.response?.data?.message ??
      (error.request ? "Could not reach the server" : error.message)
  );
  apiError.status = status;
  apiError.details = error.response?.data?.details;
  return apiError;
};

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // An expired or revoked token should not leave stale credentials behind.
    if (error.response?.status === 401) clearStoredAuth();
    return Promise.reject(toApiError(error));
  }
);

export default apiClient;
