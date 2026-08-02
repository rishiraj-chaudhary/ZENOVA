import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import ListeningPlan from "../../models/ListeningPlan.js";
import MoodEntry from "../../models/MoodEntry.js";
import PlanStep from "../../models/PlanStep.js";
import SessionOutcome from "../../models/SessionOutcome.js";
import User from "../../models/user.js";
import { adaptPlan, THRESHOLDS } from "../../services/plans/planAdaptation.js";
import { computeBehaviour, rollForwardMissedSteps } from "../../services/plans/planBehaviour.js";
import { buildReadout } from "../../services/plans/planReadout.js";
import {
  deriveTarget,
  previewPlan,
  startPlan,
  summariseHistory,
} from "../../services/plans/planService.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const makeUser = async () => {
  counter += 1;
  return User.create({
    name: `Planner-${counter}`,
    email: `plan-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
    timeZone: "Asia/Kolkata",
    consent: { moodTracking: true, grantedAt: new Date() },
  });
};

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const seedMoods = async (userId, readings) => {
  for (const [value, when] of readings) {
    await MoodEntry.create({
      userId,
      mood: value >= 4 ? "good" : value >= 3 ? "okay" : "low",
      intensity: value,
      valence: value,
      source: "check-in",
      recordedAt: when,
    });
  }
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("the target comes from their own history", () => {
  it("aims most of the way back to a level they have actually reached", async () => {
    const user = await makeUser();

    // A good stretch three weeks ago, a worse one now.
    await seedMoods(user._id, [
      [4, daysAgo(24)], [4, daysAgo(23)], [4, daysAgo(22)],
      [2, daysAgo(3)], [2, daysAgo(2)], [2, daysAgo(1)],
      [2, daysAgo(0)], [3, daysAgo(4)],
    ]);

    const history = await summariseHistory(user._id);
    const target = deriveTarget("lift", history);

    // A target someone has hit before is achievable; "be happy" is neither
    // achievable nor checkable.
    expect(target.basis).toBe("personal_best_week");
    expect(target.valence).toBeGreaterThan(history.currentMean);
    expect(target.valence).toBeLessThan(history.bestWeekMean);
    expect(target.evidence.bestWeekMean).toBeGreaterThan(0);
  });

  it("says when there is not enough history rather than inventing one", async () => {
    const user = await makeUser();
    await seedMoods(user._id, [[3, daysAgo(1)]]);

    const target = deriveTarget("lift", await summariseHistory(user._id));

    expect(target.basis).toBe("modest_default");
    expect(target.evidence.reason).toMatch(/not enough history/i);
  });

  it("handles someone with no history at all", async () => {
    const user = await makeUser();
    const history = await summariseHistory(user._id);

    expect(history.samples).toBe(0);
    expect(() => deriveTarget("wind_down", history)).not.toThrow();
  });
});

describe("laying out the plan", () => {
  it("never asks for something every single day", async () => {
    const user = await makeUser();
    const preview = await previewPlan(user._id, {
      direction: "steadier",
      durationDays: 28,
    });

    // Plans that demand something daily get abandoned.
    expect(preview.restCount).toBeGreaterThan(0);
    expect(preview.sessionCount).toBeLessThan(28);
  });

  it("creates a step for every day, sessions and rests alike", async () => {
    const user = await makeUser();
    const plan = await startPlan(user._id, { direction: "wind_down", durationDays: 14 });

    const steps = await PlanStep.find({ planId: plan._id });

    // A rest day the plan chose reads very differently from a day the user
    // skipped, so it is a real step.
    expect(steps).toHaveLength(14);
    expect(steps.filter((step) => step.kind === "rest").length).toBeGreaterThan(0);
  });

  it("refuses a second plan while one is running", async () => {
    const user = await makeUser();
    await startPlan(user._id, { direction: "lift", durationDays: 7 });

    // Two at once would make every measurement ambiguous about which caused it.
    await expect(
      startPlan(user._id, { direction: "steadier", durationDays: 7 })
    ).rejects.toThrow(/already have a plan/i);
  });

  it("schedules a wind-down plan into the evening", async () => {
    const user = await makeUser();
    const preview = await previewPlan(user._id, {
      direction: "wind_down",
      durationDays: 7,
    });

    expect(preview.scheduleHour).toBeGreaterThanOrEqual(20);
  });
});

describe("adherence and effect are different questions", () => {
  const runPlan = async (user, overrides = {}) => {
    const plan = await startPlan(user._id, {
      direction: "lift",
      durationDays: 14,
      ...overrides,
    });
    return ListeningPlan.findById(plan._id);
  };

  it("counts only steps whose moment has passed", async () => {
    const user = await makeUser();
    const plan = await runPlan(user);

    const behaviour = await computeBehaviour(plan);

    // A step due next Tuesday is not a step anyone has failed to do.
    expect(behaviour.adherence.due).toBeLessThan(14);
  });

  it("reports perfect adherence with no effect as exactly that", async () => {
    const user = await makeUser();
    const plan = await runPlan(user);

    // Every due session done, and every one of them did nothing.
    const due = await PlanStep.find({ planId: plan._id, kind: "session" }).limit(5);
    for (const step of due) {
      step.status = "done";
      step.dueAt = daysAgo(1);
      await step.save();

      await SessionOutcome.create({
        userId: user._id,
        sessionId: step._id,
        moodBefore: 3,
        moodAfter: 3,
        lift: 0,
        createdAt: new Date(),
        completedAt: new Date(),
      });
    }

    const readout = await buildReadout(await ListeningPlan.findById(plan._id));

    // The failure the metrics would otherwise call a success.
    expect(readout.adherence.rate).toBe(1);
    expect(readout.effect.lift.text).toMatch(/no measurable change/i);
  });

  it("does not claim a result from too few sessions", async () => {
    const user = await makeUser();
    const plan = await runPlan(user);

    await SessionOutcome.create({
      userId: user._id,
      sessionId: plan._id,
      moodBefore: 2,
      moodAfter: 5,
      lift: 3,
      completedAt: new Date(),
    });

    const readout = await buildReadout(await ListeningPlan.findById(plan._id));

    // One brilliant session is not a finding.
    expect(readout.effect.headline.provisional).toBe(true);
    expect(readout.effect.headline.text).toMatch(/too few/i);
  });
});

describe("adaptation", () => {
  const activePlan = async (user, direction = "lift") => {
    const plan = await startPlan(user._id, { direction, durationDays: 28 });
    return ListeningPlan.findById(plan._id);
  };

  const pastDueSessions = async (planId, count, status) => {
    const steps = await PlanStep.find({ planId, kind: "session" }).limit(count);
    for (const step of steps) {
      step.dueAt = daysAgo(2);
      step.status = status;
      await step.save();
    }
    return steps;
  };

  it("lowers the ask when someone is not keeping up", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);
    const before = plan.stepsPerWeek;

    await pastDueSessions(plan._id, 4, "missed");

    const { applied } = await adaptPlan(plan);
    const after = await ListeningPlan.findById(plan._id);

    // Repeating a demand louder does not make it easier to meet.
    expect(applied.map((a) => a.trigger)).toContain("low_adherence");
    expect(after.stepsPerWeek).toBeLessThan(before);
    expect(after.adaptations[0].change).toMatch(/sessions a week/i);
  });

  it("moves the schedule to when they actually turn up", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);

    const steps = await pastDueSessions(plan._id, 5, "done");
    for (const step of steps) {
      await SessionOutcome.create({
        userId: user._id,
        sessionId: step._id,
        moodBefore: 3,
        moodAfter: 3,
        lift: 0.5,
        hourOfDay: 23,
        completedAt: new Date(),
      });
    }

    const { applied } = await adaptPlan(plan);
    const after = await ListeningPlan.findById(plan._id);

    // They told you when they would do it, by doing it.
    expect(applied.map((a) => a.trigger)).toContain("time_drift");
    expect(after.reminderHour).toBe(23);
  });

  it("eases right back when things are getting worse, and never pushes", async () => {
    const user = await makeUser();
    await seedMoods(user._id, [[4, daysAgo(40)], [4, daysAgo(39)], [4, daysAgo(38)]]);

    const plan = await activePlan(user);
    plan.baseline = { valence: 4, arousal: 3, samples: 3 };
    await plan.save();

    // Four readings well below where they started.
    await seedMoods(user._id, [
      [2, new Date()], [2, new Date()], [2, new Date()], [1, new Date()],
    ]);

    const { applied } = await adaptPlan(await ListeningPlan.findById(plan._id));
    const after = await ListeningPlan.findById(plan._id);

    const deterioration = applied.find((a) => a.trigger === "deterioration");

    // The rule that matters most: no extra demand, and the safety plan surfaced.
    expect(deterioration).toBeTruthy();
    expect(deterioration.surfaceSafetyPlan).toBe(true);
    expect(after.stepsPerWeek).toBeLessThanOrEqual(plan.stepsPerWeek);
    expect(
      await PlanStep.countDocuments({
        planId: plan._id,
        kind: "session",
        status: "pending",
        dueAt: { $gt: new Date() },
      })
    ).toBe(0);
  });

  it("stops every other rule once deterioration fires", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);
    plan.baseline = { valence: 4, arousal: 3, samples: 4 };
    await plan.save();

    // Both deterioration and low adherence would fire.
    await pastDueSessions(plan._id, 4, "missed");
    await seedMoods(user._id, [
      [2, new Date()], [2, new Date()], [1, new Date()], [1, new Date()],
    ]);

    const { applied } = await adaptPlan(await ListeningPlan.findById(plan._id));

    // Rearranging someone's schedule is noise at that moment.
    expect(applied).toHaveLength(1);
    expect(applied[0].trigger).toBe("deterioration");
  });

  it("offers to finish early rather than padding out a plan that worked", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);
    plan.baseline = { valence: 2, arousal: 3, samples: 5 };
    plan.target = { valence: 3, arousal: null, basis: "personal_best_week" };
    await plan.save();

    await seedMoods(user._id, [
      [4, new Date()], [4, new Date()], [4, new Date()], [4, new Date()], [4, new Date()],
    ]);

    const { applied } = await adaptPlan(await ListeningPlan.findById(plan._id));

    expect(applied.map((a) => a.trigger)).toContain("rapid_improvement");
  });

  it("changes what it plays when the sessions are not shifting anything", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);

    const steps = await pastDueSessions(plan._id, 6, "done");
    for (const step of steps) {
      await SessionOutcome.create({
        userId: user._id,
        sessionId: step._id,
        moodBefore: 3,
        moodAfter: 3,
        lift: -0.1,
        hourOfDay: new Date(step.dueAt).getHours(),
        completedAt: new Date(),
      });
    }

    const { applied } = await adaptPlan(await ListeningPlan.findById(plan._id));

    // The app admitting its own prescription is not working for this person.
    expect(applied.map((a) => a.trigger)).toContain("no_measured_effect");
  });

  it("does not fire the same rule twice in three days", async () => {
    const user = await makeUser();
    const plan = await activePlan(user);
    await pastDueSessions(plan._id, 4, "missed");

    await adaptPlan(plan);
    const { applied } = await adaptPlan(await ListeningPlan.findById(plan._id));

    // Otherwise a persistent condition rewrites the plan nightly and the user
    // watches it thrash.
    expect(applied.map((a) => a.trigger)).not.toContain("low_adherence");
  });

  it("thresholds are conservative enough not to fire on noise", () => {
    expect(THRESHOLDS.MIN_DETERIORATION_SAMPLES).toBeGreaterThanOrEqual(4);
    expect(THRESHOLDS.DETERIORATION_DROP).toBeGreaterThanOrEqual(0.5);
  });
});

describe("missed steps roll forward quietly", () => {
  it("moves a missed session into the next rest day", async () => {
    const user = await makeUser();
    const plan = await startPlan(user._id, { direction: "lift", durationDays: 14 });

    const first = await PlanStep.findOne({ planId: plan._id, kind: "session" });
    first.dueAt = daysAgo(2);
    await first.save();

    const { rescheduled } = await rollForwardMissedSteps(
      await ListeningPlan.findById(plan._id)
    );

    // Nobody needs to be told they failed at listening to music.
    expect(rescheduled).toBe(1);
    expect((await PlanStep.findById(first._id)).status).toBe("rescheduled");
  });
});

describe("through the API", () => {
  const authed = (token) => ({ Authorization: `Bearer ${token}` });

  const registerAndLogin = async () => {
    counter += 1;
    const { body } = await request(app).post("/api/auth/register").send({
      name: `ApiPlanner-${counter}`,
      email: `apiplan-${counter}-${Date.now()}@example.com`,
      password: "hunter2secure",
    });
    await request(app)
      .put("/api/users/consent")
      .set(authed(body.user.token))
      .send({ moodTracking: true });
    return body.user;
  };

  it("offers the directions and lengths on offer", async () => {
    const user = await registerAndLogin();

    const { body } = await request(app)
      .get("/api/plans/directions")
      .set(authed(user.token));

    expect(body.directions.length).toBeGreaterThan(2);
    expect(body.durations).toContain(14);
  });

  it("previews without committing to anything", async () => {
    const user = await registerAndLogin();

    const { body } = await request(app)
      .post("/api/plans/preview")
      .set(authed(user.token))
      .send({ direction: "wind_down", durationDays: 7 });

    expect(body.sessionCount).toBeGreaterThan(0);
    expect(await ListeningPlan.countDocuments({})).toBe(0);
  });

  it("starts, reports, and stops without friction", async () => {
    const user = await registerAndLogin();

    const started = await request(app)
      .post("/api/plans/start")
      .set(authed(user.token))
      .send({ direction: "steadier", durationDays: 7 });
    expect(started.status).toBe(201);

    const current = await request(app)
      .get("/api/plans/current")
      .set(authed(user.token));
    expect(current.body.plan.status).toBe("active");
    expect(current.body.steps).toHaveLength(7);

    const stopped = await request(app).post("/api/plans/stop").set(authed(user.token));
    expect(stopped.body.plan.status).toBe("stopped");
  });

  it("shows one person nothing of another's plan", async () => {
    const mine = await registerAndLogin();
    const theirs = await registerAndLogin();

    await request(app)
      .post("/api/plans/start")
      .set(authed(theirs.token))
      .send({ direction: "lift", durationDays: 7 });

    const { body } = await request(app).get("/api/plans/current").set(authed(mine.token));

    expect(body.plan).toBeNull();
  });

  it("refuses a length that is not on offer", async () => {
    const user = await registerAndLogin();

    const response = await request(app)
      .post("/api/plans/start")
      .set(authed(user.token))
      .send({ direction: "lift", durationDays: 100 });

    expect(response.status).toBe(400);
  });
});

describe("a target has to actually be a target", () => {
  it("does not aim at exactly where the person already is", async () => {
    const user = await makeUser();

    // Everything in one week: "your best week" and "this week" are the same
    // number, so a naive derivation lands on the current mean.
    const now = new Date();
    await seedMoods(user._id, [
      [3, now], [3, now], [3, now], [3, now],
      [3, now], [3, now], [3, now], [3, now],
    ]);

    const history = await summariseHistory(user._id);
    const target = deriveTarget("lift", history);

    expect(history.bestWeekMean).toBeCloseTo(history.currentMean, 2);
    // A plan aiming at no change is not a plan.
    expect(target.basis).toBe("modest_default");
    expect(target.valence).toBeGreaterThan(history.currentMean);
  });

  it("still uses a personal target when there is a genuinely better week", async () => {
    const user = await makeUser();
    await seedMoods(user._id, [
      [5, daysAgo(30)], [5, daysAgo(29)], [4, daysAgo(28)],
      [2, daysAgo(2)], [2, daysAgo(1)], [2, new Date()],
      [2, new Date()], [2, new Date()],
    ]);

    const target = deriveTarget("lift", await summariseHistory(user._id));

    expect(target.basis).toBe("personal_best_week");
  });
});
