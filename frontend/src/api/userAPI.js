import apiClient from "./client.js";

export const fetchUserProfile = () => apiClient.get("/users/profile");

export const updatePreferences = (preferences) =>
  apiClient.put("/users/preferences", { preferences });

export const updateConsent = (moodTracking) =>
  apiClient.put("/users/consent", { moodTracking });

export const completeOnboarding = ({ preferences, moodTrackingConsent }) =>
  apiClient.post("/users/onboarding", { preferences, moodTrackingConsent });

export const searchUsers = (query) =>
  apiClient.get("/users/search", { params: { q: query } });
