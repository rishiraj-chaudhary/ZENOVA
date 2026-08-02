import { useCallback, useEffect, useState } from "react";
import * as agentAPI from "../api/agentAPI.js";

/**
 * The assistant conversation.
 *
 * The transcript lives on the server, so this loads it rather than owning it —
 * which also means it survives a reload, a new tab and a different device
 * without any of the sessionStorage juggling the recommendation chat needs.
 */
const useAssistant = () => {
  const [turns, setTurns] = useState([]);
  const [pendingActions, setPendingActions] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    agentAPI
      .fetchConversation()
      .then(({ turns: loaded }) => setTurns(loaded ?? []))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  const send = useCallback(async (message) => {
    const trimmed = message.trim();
    if (!trimmed) return null;

    setTurns((current) => [...current, { role: "user", content: trimmed }]);
    setPendingActions([]);
    setThinking(true);
    setError(null);
    setNotice(null);

    try {
      const result = await agentAPI.sendMessage(trimmed);

      if (result.reply) {
        setTurns((current) => [...current, { role: "assistant", content: result.reply }]);
      }

      setPendingActions(result.pendingActions ?? []);

      // A truncated or vetoed run must never read as a confident answer.
      if (result.degraded) {
        setNotice(
          result.degradedReason
            ? `That answer is incomplete — ${result.degradedReason}.`
            : "That answer may be incomplete."
        );
      } else if (result.tainted) {
        setNotice(
          "This conversation has read something written by someone else, so I've " +
            "turned off anything that makes changes."
        );
      }

      return result;
    } catch (sendError) {
      setError(sendError.message);
      return null;
    } finally {
      setThinking(false);
    }
  }, []);

  const respondToAction = useCallback(async ({ token, accept }) => {
    const result = await agentAPI.respondToAction({ token, accept });

    if (result.performed) {
      setTurns((current) => [
        ...current,
        { role: "assistant", content: `Done — ${result.summary.toLowerCase()}.` },
      ]);
    }

    setPendingActions((current) => current.filter((action) => action.token !== token));
    return result;
  }, []);

  const clear = useCallback(async () => {
    await agentAPI.clearConversation();
    setTurns([]);
    setPendingActions([]);
  }, []);

  return {
    turns,
    pendingActions,
    thinking,
    loading,
    error,
    notice,
    send,
    respondToAction,
    clear,
  };
};

export default useAssistant;
