import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import TaskLock from "../../models/TaskLock.js";
import { acquireLock, releaseLock } from "../../utils/taskLock.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("acquireLock", () => {
  it("grants the lock to exactly one of many concurrent callers", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => acquireLock("refresh", 60_000))
    );

    // This is the property the in-process Map could not provide across
    // instances: N callers, one winner.
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await TaskLock.countDocuments({ key: "refresh" })).toBe(1);
  });

  it("refuses a second acquisition while the lock is held", async () => {
    expect(await acquireLock("refresh", 60_000)).toBe(true);
    expect(await acquireLock("refresh", 60_000)).toBe(false);
  });

  it("allows re-acquisition once the lock has expired", async () => {
    expect(await acquireLock("refresh", 1)).toBe(true);

    // A crashed holder must not deadlock the task forever.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(await acquireLock("refresh", 60_000)).toBe(true);
  });

  it("keeps separate keys independent", async () => {
    expect(await acquireLock("weekly", 60_000)).toBe(true);
    expect(await acquireLock("monthly", 60_000)).toBe(true);
  });

  it("frees the lock on release", async () => {
    await acquireLock("refresh", 60_000);
    await releaseLock("refresh");

    expect(await acquireLock("refresh", 60_000)).toBe(true);
  });
});
