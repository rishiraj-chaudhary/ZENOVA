import apiClient from "./client.js";

export const logMood = ({ mood, intensity, context }) =>
  apiClient.post("/wellbeing/moods", { mood, intensity, context });

export const fetchMoodHistory = ({ page = 1, limit = 30 } = {}) =>
  apiClient.get("/wellbeing/moods", { params: { page, limit } });

export const fetchInsights = (periodDays = 30) =>
  apiClient.get("/wellbeing/insights", { params: { periodDays } });

/**
 * Optional fields are omitted rather than sent as null. The server tolerates
 * null now, but a payload that says "sessionId: null" is claiming something it
 * does not mean.
 */
export const submitFeedback = ({ musicId, signal, sessionId, moodAtTime }) =>
  apiClient.post("/wellbeing/feedback", {
    musicId,
    signal,
    ...(sessionId ? { sessionId } : {}),
    ...(moodAtTime ? { moodAtTime } : {}),
  });

/** What has been measured to help — personal evidence first, then population. */
export const fetchProvenSongs = (startingMood) =>
  apiClient.get("/wellbeing/proven", {
    params: startingMood ? { startingMood } : {},
  });

/** The user's standing ratings, keyed by song id, so the buttons show state. */
export const fetchFeedbackSignals = () => apiClient.get("/wellbeing/feedback");

export const clearFeedback = (musicId) =>
  apiClient.delete(`/wellbeing/feedback/${musicId}`);

export const startSession = ({ sessionId, moodBefore }) =>
  apiClient.post("/wellbeing/sessions/start", { sessionId, moodBefore });

export const completeSession = ({ sessionId, moodAfter }) =>
  apiClient.post("/wellbeing/sessions/complete", { sessionId, moodAfter });

/** Listening is worth recording even when the after-rating never comes. */
export const recordSessionListened = (sessionId) =>
  apiClient.post("/wellbeing/sessions/listened", { sessionId });

export const fetchSupportResources = () => apiClient.get("/wellbeing/support");
