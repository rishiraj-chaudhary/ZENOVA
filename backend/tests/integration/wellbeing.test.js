import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../../services/geminiService.js", () => ({
  generateJson: vi.fn().mockResolvedValue(null),
  generateText: vi.fn().mockResolvedValue("calm"),
}));

const { default: MoodEntry } = await import("../../models/MoodEntry.js");
const { default: User } = await import("../../models/user.js");
const { buildTestApp } = await import("../helpers/app.js");
const { clearTestDb, connectTestDb, disconnectTestDb } = await import("../helpers/db.js");

const app = buildTestApp();

const registerAndLogin = async ({ consent = true } = {}) => {
  const credentials = {
    name: "Mood Tester",
    email: `mood-${Date.now()}-${Math.round(performance.now())}@example.com`,
    password: "hunter2secure",
  };

  const { body } = await request(app).post("/api/auth/register").send(credentials);
  const token = body.token;

  if (consent) {
    await request(app)
      .put("/api/users/consent")
      .set("Authorization", `Bearer ${token}`)
      .send({ moodTracking: true });
  }

  return { token, userId: body.user._id };
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("mood check-ins", () => {
  it("records a check-in once consent is given", async () => {
    const { token, userId } = await registerAndLogin();

    const response = await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm", intensity: 4 });

    expect(response.status).toBe(201);
    expect(await MoodEntry.countDocuments({ userId })).toBe(1);
  });

  it("stores nothing without consent", async () => {
    const { token, userId } = await registerAndLogin({ consent: false });

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm", intensity: 4 });

    // Consent is enforced at the write, so no code path can persist by accident.
    expect(await MoodEntry.countDocuments({ userId })).toBe(0);
  });

  it("stops recording after consent is withdrawn", async () => {
    const { token, userId } = await registerAndLogin();

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm" });

    await request(app)
      .put("/api/users/consent")
      .set("Authorization", `Bearer ${token}`)
      .send({ moodTracking: false });

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "anxious" });

    expect(await MoodEntry.countDocuments({ userId })).toBe(1);
  });

  it("validates the payload", async () => {
    const { token } = await registerAndLogin();

    const response = await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "", intensity: 99 });

    expect(response.status).toBe(400);
  });

  it("pages mood history", async () => {
    const { token } = await registerAndLogin();

    for (const mood of ["calm", "sad", "happy"]) {
      await request(app)
        .post("/api/wellbeing/moods")
        .set("Authorization", `Bearer ${token}`)
        .send({ mood });
    }

    const response = await request(app)
      .get("/api/wellbeing/moods?page=1&limit=2")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.entries).toHaveLength(2);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.pagination.totalPages).toBe(2);
  });

  it("never returns another user's entries", async () => {
    const alice = await registerAndLogin();
    const bob = await registerAndLogin();

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ mood: "calm" });

    const response = await request(app)
      .get("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${bob.token}`);

    expect(response.body.entries).toHaveLength(0);
  });
});

describe("insights", () => {
  it("reports insufficient data rather than an empty dashboard", async () => {
    const { token } = await registerAndLogin();

    const response = await request(app)
      .get("/api/wellbeing/insights")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.hasEnoughData).toBe(false);
    expect(response.body.minimumEntriesNeeded).toBeGreaterThan(0);
  });

  it("computes statistics once enough entries exist", async () => {
    const { token } = await registerAndLogin();

    for (const mood of ["calm", "calm", "anxious", "happy", "sad", "calm"]) {
      await request(app)
        .post("/api/wellbeing/moods")
        .set("Authorization", `Bearer ${token}`)
        .send({ mood });
    }

    const response = await request(app)
      .get("/api/wellbeing/insights")
      .set("Authorization", `Bearer ${token}`);

    expect(response.body.hasEnoughData).toBe(true);
    expect(response.body.topMoods[0].mood).toBe("calm");
    expect(response.body.series.length).toBeGreaterThan(0);
  });
});

describe("gamification stats isolation", () => {
  it("returns the caller's own stats even when another id is in the URL", async () => {
    const alice = await registerAndLogin();
    const bob = await registerAndLogin();

    const response = await request(app)
      .get(`/api/gamification/stats/${alice.userId}`)
      .set("Authorization", `Bearer ${bob.token}`);

    expect(response.status).toBe(200);
    // The previous implementation trusted :userId, exposing anyone's progress.
    expect(response.body.points).toBe(0);
  });
});

describe("privacy", () => {
  it("exports the caller's data as a download", async () => {
    const { token } = await registerAndLogin();

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm" });

    const response = await request(app)
      .get("/api/privacy/export")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");

    const exported = JSON.parse(response.text);
    expect(exported.moodHistory).toHaveLength(1);
    expect(exported.account.email).toBeTruthy();
    expect(JSON.stringify(exported)).not.toContain("$2b$");
  });

  it("deletes wellbeing data but keeps the account", async () => {
    const { token, userId } = await registerAndLogin();

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm" });

    const response = await request(app)
      .delete("/api/privacy/wellbeing-data")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(await MoodEntry.countDocuments({ userId })).toBe(0);
    expect(await User.findById(userId)).not.toBeNull();
  });

  it("requires the typed confirmation to delete an account", async () => {
    const { token, userId } = await registerAndLogin();

    const rejected = await request(app)
      .delete("/api/privacy/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirm: "yes" });

    expect(rejected.status).toBe(400);
    expect(await User.findById(userId)).not.toBeNull();
  });

  it("deletes the account and its data when confirmed", async () => {
    const { token, userId } = await registerAndLogin();

    await request(app)
      .post("/api/wellbeing/moods")
      .set("Authorization", `Bearer ${token}`)
      .send({ mood: "calm" });

    const response = await request(app)
      .delete("/api/privacy/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ confirm: "DELETE MY ACCOUNT" });

    expect(response.status).toBe(200);
    expect(await User.findById(userId)).toBeNull();
    expect(await MoodEntry.countDocuments({ userId })).toBe(0);
  });
});
