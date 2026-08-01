import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

/**
 * These assert what the CLIENT receives, not what a service returns.
 *
 * Every bug here shipped with green unit tests: each service was correct in
 * isolation, but nothing checked that the fields the UI branches on actually
 * survive the trip through toPublicUser. That gap produced four separate
 * user-visible failures.
 */
const app = buildTestApp();

let counter = 0;
const credentials = () => ({
  name: "Payload Tester",
  email: `payload-${(counter += 1)}-${Date.now()}@example.com`,
  password: "hunter2secure",
});

const registerUser = async () => {
  const creds = credentials();
  const { body } = await request(app).post("/api/auth/register").send(creds);
  return { ...body, creds };
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("auth payload completeness", () => {
  it.each([
    ["register", async () => (await registerUser()).user],
    [
      "login",
      async () => {
        const { creds } = await registerUser();
        const { body } = await request(app)
          .post("/api/auth/login")
          .send({ email: creds.email, password: creds.password });
        return body.user;
      },
    ],
    [
      "refresh",
      async () => {
        const { refreshToken } = await registerUser();
        const { body } = await request(app)
          .post("/api/auth/refresh")
          .send({ refreshToken });
        return body.user;
      },
    ],
  ])("%s returns the fields the client branches on", async (_name, fetchUser) => {
    const user = await fetchUser();

    // needsOnboarding reads onboardedAt; without it the intro modal is shown
    // on every login with no way to dismiss it.
    expect(user).toHaveProperty("onboardedAt");
    // Profile's check-in card and Settings' toggle both read consent.
    expect(user).toHaveProperty("consent");
    expect(user.consent).toHaveProperty("moodTracking");
    expect(user).toHaveProperty("preferences");
  });

  it("never leaks the password hash", async () => {
    const { user } = await registerUser();
    expect(JSON.stringify(user)).not.toMatch(/\$2[aby]\$/);
  });

  it("reports onboardedAt as set once onboarding is complete", async () => {
    const { user, creds } = await registerUser();
    expect(user.onboardedAt).toBeNull();

    const token = user.token;
    await request(app)
      .post("/api/users/onboarding")
      .set("Authorization", `Bearer ${token}`)
      .send({ preferences: ["Lo-fi"], moodTrackingConsent: true });

    const { body } = await request(app)
      .post("/api/auth/login")
      .send({ email: creds.email, password: creds.password });

    // The bug: this was null on every login, so onboarding replayed forever.
    expect(body.user.onboardedAt).not.toBeNull();
    expect(body.user.consent.moodTracking).toBe(true);
  });
});

describe("onboarding replay", () => {
  it("cannot overwrite preferences a user changed later", async () => {
    const { user } = await registerUser();
    const token = user.token;
    const auth = { Authorization: `Bearer ${token}` };

    await request(app)
      .post("/api/users/onboarding")
      .set(auth)
      .send({ preferences: ["Lo-fi"], moodTrackingConsent: true });

    await request(app)
      .put("/api/users/preferences")
      .set(auth)
      .send({ preferences: ["Jazz", "Classical"] });

    // A replay used to rewrite these to whatever chips were clicked.
    await request(app)
      .post("/api/users/onboarding")
      .set(auth)
      .send({ preferences: ["Metal"], moodTrackingConsent: false });

    const { body } = await request(app).get("/api/users/profile").set(auth);
    expect(body.preferences).toEqual(["Jazz", "Classical"]);
  });

  it("cannot silently re-grant withdrawn consent", async () => {
    const { user } = await registerUser();
    const auth = { Authorization: `Bearer ${user.token}` };

    await request(app)
      .post("/api/users/onboarding")
      .set(auth)
      .send({ preferences: ["Lo-fi"], moodTrackingConsent: true });

    await request(app).put("/api/users/consent").set(auth).send({ moodTracking: false });

    // The forced modal had consent pre-ticked, so a replay reversed a GDPR
    // Art. 9 decision through a dialog the user could not dismiss.
    await request(app)
      .post("/api/users/onboarding")
      .set(auth)
      .send({ preferences: ["Metal"], moodTrackingConsent: true });

    const { body } = await request(app).get("/api/users/profile").set(auth);
    expect(body.consent.moodTracking).toBe(false);
  });
});

describe("refresh token rotation under concurrency", () => {
  it("lets exactly one of two racing refreshes win", async () => {
    const { refreshToken } = await registerUser();

    const [a, b] = await Promise.all([
      request(app).post("/api/auth/refresh").send({ refreshToken }),
      request(app).post("/api/auth/refresh").send({ refreshToken }),
    ]);

    // Both used to succeed, which let a stolen token fork a parallel live
    // chain that reuse detection never noticed.
    const succeeded = [a, b].filter((r) => r.status === 200);
    expect(succeeded).toHaveLength(1);
  });

  it("revokes the family when a spent token is replayed", async () => {
    const { refreshToken } = await registerUser();

    const { body: rotated } = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    await request(app).post("/api/auth/refresh").send({ refreshToken });

    const afterCompromise = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotated.refreshToken });

    expect(afterCompromise.status).toBe(401);
  });

  it("revokes server-side when logout carries the token in the body", async () => {
    const { refreshToken } = await registerUser();

    // The client sends no cookie when it is blocked cross-site, so the token
    // must travel in the body or logout only clears the tab.
    await request(app).post("/api/auth/logout").send({ refreshToken });

    const response = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(response.status).toBe(401);
  });
});
