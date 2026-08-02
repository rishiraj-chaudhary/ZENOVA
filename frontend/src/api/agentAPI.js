import apiClient from "./client.js";

/**
 * The assistant.
 *
 * No conversationHistory parameter, deliberately: the server holds the
 * transcript. A client that could post its own history could rewrite what was
 * said to steer the model, and the untrusted-content boundary does not help
 * there — the content arrives inside the region the model is told is real.
 */
/**
 * The Spotify token travels in a header rather than the body.
 *
 * It belongs to the browser's Spotify session, not to ours, and it is not part
 * of what the user said — keeping it out of the body keeps it out of anything
 * that records a message.
 */
const spotifyHeader = () => {
  try {
    const session = JSON.parse(localStorage.getItem("spotify_session") ?? "null");
    return session?.accessToken ? { "X-Spotify-Token": session.accessToken } : {};
  } catch {
    return {};
  }
};

export const sendMessage = (message) =>
  apiClient.post("/agent/chat", { message }, { headers: spotifyHeader() });

export const fetchConversation = () => apiClient.get("/agent/conversation");

export const clearConversation = () => apiClient.delete("/agent/conversation");

/** Carries out something the assistant proposed. The token is the consent. */
export const respondToAction = ({ token, accept }) =>
  apiClient.post(
    "/agent/actions/respond",
    { token, accept },
    // Playback is carried out at redemption, so the token has to be here too.
    { headers: spotifyHeader() }
  );

export const fetchMemories = () => apiClient.get("/agent/memories");

export const forgetMemory = (memoryId) => apiClient.delete(`/agent/memories/${memoryId}`);
