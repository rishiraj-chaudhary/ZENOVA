import { useCallback, useEffect, useState } from "react";

const WELCOME_TEXT =
  "Hi! I'm ZENOVA. Tell me how you're feeling and I'll suggest music for it — " +
  "or just ask for something to listen to.";

/** Capped so a long conversation cannot exhaust the ~5MB storage quota. */
const MAX_STORED_MESSAGES = 50;

const keyFor = (userId, kind) => `${kind}_${userId}`;

const readJson = (key, fallback) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage disabled; the conversation still works in memory.
  }
};

/**
 * Owns the conversation and its persistence.
 *
 * Extracted from Chatbot so the component renders rather than also managing
 * three separate sessionStorage keys across four effects. The message cap is
 * new: the previous implementation stored every message forever and would
 * eventually throw on write.
 */
const useChatMessages = (userId) => {
  const [messages, setMessages] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [mood, setMood] = useState(null);

  /**
   * The open measurement session, kept with the songs it belongs to.
   *
   * Recommendations survived a refresh but the session id did not, so the songs
   * came back and the before/after check-in did not — silently dropping the one
   * measurement the effect ledger is built from, on every reload.
   */
  const [session, setSession] = useState({ sessionId: null, curated: false });

  useEffect(() => {
    if (!userId) {
      setMessages([]);
      setRecommendations([]);
      setMood(null);
      setSession({ sessionId: null, curated: false });
      return;
    }

    const saved = readJson(keyFor(userId, "chat_messages"), []);
    setMessages(saved.length ? saved : [{ text: WELCOME_TEXT, sender: "assistant" }]);
    setRecommendations(readJson(keyFor(userId, "recommendations"), []));
    setMood(sessionStorage.getItem(keyFor(userId, "mood")));
    setSession(
      readJson(keyFor(userId, "session"), { sessionId: null, curated: false })
    );
  }, [userId]);

  useEffect(() => {
    if (!userId || messages.length === 0) return;
    writeJson(keyFor(userId, "chat_messages"), messages.slice(-MAX_STORED_MESSAGES));
  }, [messages, userId]);

  useEffect(() => {
    if (!userId || recommendations.length === 0) return;
    writeJson(keyFor(userId, "recommendations"), recommendations);
    if (mood) sessionStorage.setItem(keyFor(userId, "mood"), mood);
  }, [recommendations, mood, userId]);

  useEffect(() => {
    if (!userId) return;
    writeJson(keyFor(userId, "session"), session);
  }, [session, userId]);

  const appendMessage = useCallback(
    (message) => setMessages((current) => [...current, message]),
    []
  );

  return {
    messages,
    appendMessage,
    recommendations,
    setRecommendations,
    mood,
    setMood,
    session,
    setSession,
  };
};

export default useChatMessages;
