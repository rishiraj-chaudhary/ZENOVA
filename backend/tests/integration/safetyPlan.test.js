import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import SafetyPlan from "../../models/SafetyPlan.js";
import { getPlan, planForCrisis, savePlan } from "../../services/safetyPlanService.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const registerUser = async () => {
  counter += 1;
  const { body } = await request(app).post("/api/auth/register").send({
    name: `Planner-${counter}`,
    email: `plan-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
  });
  return { token: body.user.token, userId: body.user._id };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

const PLAN = {
  warningSigns: "I stop replying to people\nI stay up past 3am",
  copingSteps: "Walk to the park\nCall my sister",
  peopleWhoHelp: "Priya — 98xxxxxx",
  reasonsToStay: "My dog. Finishing the degree.",
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("the safety plan is stored encrypted", () => {
  it("never writes the plaintext to the database", async () => {
    const user = await registerUser();
    await savePlan(user.userId, PLAN);

    const raw = await SafetyPlan.findOne({ userId: user.userId }).lean();

    // It names real people and real coping methods.
    expect(raw.peopleWhoHelp).not.toContain("Priya");
    expect(JSON.stringify(raw)).not.toContain("my sister");
    expect(raw.warningSigns).toMatch(/^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\./);
  });

  it("reads back exactly what was written, verbatim", async () => {
    const user = await registerUser();
    await savePlan(user.userId, PLAN);

    const plan = await getPlan(user.userId);

    // Their words, not a paraphrase — a rewritten coping step is no longer the
    // thing they decided would help.
    expect(plan.warningSigns).toBe(PLAN.warningSigns);
    expect(plan.peopleWhoHelp).toBe(PLAN.peopleWhoHelp);
  });

  it("treats an undecryptable plan as absent rather than showing garbage", async () => {
    const user = await registerUser();
    await savePlan(user.userId, PLAN);
    await SafetyPlan.updateOne(
      { userId: user.userId },
      { $set: { warningSigns: "not.valid.ciphertext" } }
    );

    const plan = await getPlan(user.userId);

    // Nobody should be looking at corrupted output in a bad moment.
    expect(plan.warningSigns).toBeNull();
    expect(plan.copingSteps).toBe(PLAN.copingSteps);
  });

  it("reports no plan at all when every field is empty", async () => {
    const user = await registerUser();
    await savePlan(user.userId, { warningSigns: "   " });

    expect(await getPlan(user.userId)).toBeNull();
  });
});

describe("the plan belongs to its author", () => {
  it("is readable through the API by the person who wrote it", async () => {
    const user = await registerUser();
    await request(app).put("/api/wellbeing/safety-plan").set(authed(user.token)).send(PLAN);

    const { body } = await request(app)
      .get("/api/wellbeing/safety-plan")
      .set(authed(user.token));

    expect(body.plan.copingSteps).toBe(PLAN.copingSteps);
  });

  it("is invisible to anyone else", async () => {
    const author = await registerUser();
    const other = await registerUser();
    await request(app).put("/api/wellbeing/safety-plan").set(authed(author.token)).send(PLAN);

    const { body } = await request(app)
      .get("/api/wellbeing/safety-plan")
      .set(authed(other.token));

    expect(body.plan).toBeNull();
  });

  it("cannot be read without signing in", async () => {
    const response = await request(app).get("/api/wellbeing/safety-plan");
    expect(response.status).toBe(401);
  });

  it("can be deleted by its author", async () => {
    const user = await registerUser();
    await request(app).put("/api/wellbeing/safety-plan").set(authed(user.token)).send(PLAN);
    await request(app).delete("/api/wellbeing/safety-plan").set(authed(user.token));

    expect(await getPlan(user.userId)).toBeNull();
  });
});

describe("what is shown at a hard moment", () => {
  it("includes only the sections the person actually filled in", async () => {
    const user = await registerUser();
    await savePlan(user.userId, { copingSteps: "Walk to the park" });

    const crisis = await planForCrisis(user.userId);

    // Empty headings in a crisis are noise.
    expect(crisis.sections).toHaveLength(1);
    expect(crisis.sections[0].body).toBe("Walk to the park");
  });

  it("returns nothing when there is no plan, so helplines stand alone", async () => {
    const user = await registerUser();

    // Strictly additive: a missing plan must never make the response worse
    // than it was before this feature existed.
    expect(await planForCrisis(user.userId)).toBeNull();
  });

  it("frames each section as the person's own words", async () => {
    const user = await registerUser();
    await savePlan(user.userId, PLAN);

    const crisis = await planForCrisis(user.userId);
    const headings = crisis.sections.map((section) => section.heading);

    expect(headings.some((heading) => /you said/i.test(heading))).toBe(true);
  });
});
