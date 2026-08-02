import { useCallback, useEffect, useState } from "react";
import * as planAPI from "../api/planAPI.js";

/**
 * The user's current plan, if they have one.
 *
 * Adherence and effect are kept apart all the way to the screen, because a plan
 * with perfect adherence and no measured movement is a failure the numbers
 * would otherwise call a success.
 */
const usePlan = () => {
  const [plan, setPlan] = useState(null);
  const [steps, setSteps] = useState([]);
  const [nextStep, setNextStep] = useState(null);
  const [behaviour, setBehaviour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const result = await planAPI.fetchCurrentPlan();
      setPlan(result.plan);
      setSteps(result.steps ?? []);
      setNextStep(result.nextStep ?? null);
      setBehaviour(result.behaviour ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = useCallback(
    async (operation) => {
      try {
        await operation();
        await refresh();
      } catch (actionError) {
        setError(actionError.message);
        throw actionError;
      }
    },
    [refresh]
  );

  return {
    plan,
    steps,
    nextStep,
    behaviour,
    loading,
    error,
    refresh,
    start: useCallback((options) => act(() => planAPI.startPlan(options)), [act]),
    pause: useCallback(() => act(planAPI.pausePlan), [act]),
    resume: useCallback(() => act(planAPI.resumePlan), [act]),
    stop: useCallback(() => act(planAPI.stopPlan), [act]),
  };
};

export default usePlan;
