import apiClient from "./client.js";

/** Directions, ranked by what the user's own data suggests, with reasons. */
export const fetchDirections = () => apiClient.get("/plans/directions");

/** What a step actually asks for: the songs, the length, the point of it. */
export const fetchStepGuidance = (stepId) =>
  apiClient.get(`/plans/steps/${stepId}/guidance`);

/** Turns a step into a live measured session, without leaving the page. */
export const beginStep = ({ stepId, moodBefore, arousalBefore }) =>
  apiClient.post(`/plans/steps/${stepId}/begin`, {
    moodBefore,
    ...(arousalBefore ? { arousalBefore } : {}),
  });

/** What a plan would look like, without committing to it. */
export const previewPlan = ({ direction, durationDays }) =>
  apiClient.post("/plans/preview", { direction, durationDays });

export const startPlan = ({ direction, durationDays, reminderHour }) =>
  apiClient.post("/plans/start", {
    direction,
    durationDays,
    ...(reminderHour != null ? { reminderHour } : {}),
  });

export const fetchCurrentPlan = () => apiClient.get("/plans/current");

export const fetchReadout = () => apiClient.get("/plans/readout");

export const pausePlan = () => apiClient.post("/plans/pause");
export const resumePlan = () => apiClient.post("/plans/resume");
export const stopPlan = () => apiClient.post("/plans/stop");

/** Links a recommendation to the step it satisfies. */
export const attachSession = ({ stepId, sessionId }) =>
  apiClient.post(`/plans/steps/${stepId}/session`, { sessionId });
