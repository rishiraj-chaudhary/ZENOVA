import apiClient from "./client.js";

export const logMood = ({ mood, intensity, context }) =>
  apiClient.post("/wellbeing/moods", { mood, intensity, context });

export const fetchMoodHistory = ({ page = 1, limit = 30 } = {}) =>
  apiClient.get("/wellbeing/moods", { params: { page, limit } });

export const fetchInsights = (periodDays = 30) =>
  apiClient.get("/wellbeing/insights", { params: { periodDays } });

export const submitFeedback = ({ musicId, signal, sessionId, moodAtTime }) =>
  apiClient.post("/wellbeing/feedback", { musicId, signal, sessionId, moodAtTime });

export const clearFeedback = (musicId) =>
  apiClient.delete(`/wellbeing/feedback/${musicId}`);

export const startSession = ({ sessionId, moodBefore }) =>
  apiClient.post("/wellbeing/sessions/start", { sessionId, moodBefore });

export const completeSession = ({ sessionId, moodAfter }) =>
  apiClient.post("/wellbeing/sessions/complete", { sessionId, moodAfter });

export const fetchSupportResources = () => apiClient.get("/wellbeing/support");
