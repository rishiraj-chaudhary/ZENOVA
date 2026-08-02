import apiClient from "./client.js";

/**
 * The assistant.
 *
 * No conversationHistory parameter, deliberately: the server holds the
 * transcript. A client that could post its own history could rewrite what was
 * said to steer the model, and the untrusted-content boundary does not help
 * there — the content arrives inside the region the model is told is real.
 */
export const sendMessage = (message) => apiClient.post("/agent/chat", { message });

export const fetchConversation = () => apiClient.get("/agent/conversation");

export const clearConversation = () => apiClient.delete("/agent/conversation");

/** Carries out something the assistant proposed. The token is the consent. */
export const respondToAction = ({ token, accept }) =>
  apiClient.post("/agent/actions/respond", { token, accept });

export const fetchMemories = () => apiClient.get("/agent/memories");

export const forgetMemory = (memoryId) => apiClient.delete(`/agent/memories/${memoryId}`);
