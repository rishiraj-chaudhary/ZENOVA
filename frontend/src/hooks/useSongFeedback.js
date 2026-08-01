import { useCallback, useEffect, useState } from "react";
import * as wellbeingAPI from "../api/wellbeingAPI.js";

/**
 * The user's standing like/skip ratings, keyed by song id.
 *
 * Loaded once per mount so every rating control can show what it already knows
 * rather than starting blank. Without it a rating vanished on reload, which
 * looked exactly like the write having failed.
 */
const useSongFeedback = () => {
  const [signals, setSignals] = useState({});

  useEffect(() => {
    let cancelled = false;

    wellbeingAPI
      .fetchFeedbackSignals()
      .then(({ signals: loaded }) => {
        if (!cancelled) setSignals(loaded ?? {});
      })
      // Advisory: the controls still work, they just start empty.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const remember = useCallback((musicId, signal) => {
    setSignals((current) => {
      const next = { ...current };
      if (signal) next[musicId] = signal;
      else delete next[musicId];
      return next;
    });
  }, []);

  return { signals, remember };
};

export default useSongFeedback;
