import { runCompaction } from "./memory/compaction.js";
import { rebuildNoListenBaseline } from "./baselineService.js";
import logger from "../utils/logger.js";

/**
 * Background work, on intervals, guarded by the distributed lock.
 *
 * Deliberately setInterval rather than a queue or a cron dependency: each job
 * already takes a Mongo-backed lock with its own TTL, so a second instance
 * simply finds the lock held and skips. The scheduling primitive that exists is
 * enough, and adding infrastructure for three periodic jobs would be its own
 * kind of debt.
 */
const HOUR = 60 * 60 * 1000;

const JOBS = [
  {
    name: "no-listen baseline",
    everyMs: 6 * HOUR,
    run: () => rebuildNoListenBaseline(),
  },
  {
    name: "memory compaction",
    everyMs: 24 * HOUR,
    run: () => runCompaction(),
  },
];

const timers = [];

export const startScheduledJobs = () => {
  for (const job of JOBS) {
    const tick = async () => {
      try {
        const result = await job.run();
        if (!result?.skipped) logger.info(`${job.name} ran`, result ?? {});
      } catch (error) {
        // A failed background job must never take the process with it.
        logger.warn(`${job.name} failed`, { detail: error.message });
      }
    };

    // Not on boot: a deploy should serve requests before it starts grinding.
    const timer = setInterval(tick, job.everyMs);
    timer.unref?.();
    timers.push(timer);
  }

  logger.info("scheduled jobs started", { count: JOBS.length });
  return timers.length;
};

export const stopScheduledJobs = () => {
  timers.forEach(clearInterval);
  timers.length = 0;
};
