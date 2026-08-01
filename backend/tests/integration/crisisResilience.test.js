import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Simulates the model being unavailable — the condition under which the crisis
// paths previously returned 500 instead of a helpline.
vi.mock("../../services/geminiService.js", () => ({
  generateJson: vi.fn().mockRejectedValue(new Error("503 Service Unavailable")),
  generateText: vi.fn().mockRejectedValue(new Error("503 Service Unavailable")),
}));

const { buildTestApp } = await import("../helpers/app.js");
const { clearTestDb, connectTestDb, disconnectTestDb } = await import("../helpers/db.js");

const app = buildTestApp();

let counter = 0;
const registerUser = async () => {
  const { body } = await request(app)
    .post("/api/auth/register")
    .send({
      name: "Crisis Tester",
      email: `crisis-${(counter += 1)}-${Date.now()}@example.com`,
      password: "hunter2secure",
    });
  return body.user.token;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

/**
 * The safety layer's entire purpose is to hold up on the worst day. These
 * assert it holds when the model is down — the case where it previously failed.
 */
describe("crisis handling while the model is unavailable", () => {
  it("returns support, not a 500, from the recommendations endpoint", async () => {
    const token = await registerUser();

    const response = await request(app)
      .post("/api/music/recommend/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept-Language", "en-IN")
      .send({ message: "I want to kill myself" });

    expect(response.status).toBe(200);
    expect(response.body.riskLevel).toBe("crisis");
    expect(response.body.recommendations).toEqual([]);
    expect(response.body.supportResources.length).toBeGreaterThan(0);
  });

  it("returns support, not a 500, from analyze-mood", async () => {
    // Guest-accessible, and it used to compute the resources then discard them.
    const response = await request(app)
      .post("/api/gemini/analyze-mood")
      .set("Accept-Language", "en-IN")
      .send({ userInput: "I want to kill myself" });

    expect(response.status).toBe(200);
    expect(response.body.riskLevel).toBe("crisis");
    expect(response.body.supportResources.length).toBeGreaterThan(0);
  });

  it("returns support, not a 500, from chat", async () => {
    const response = await request(app)
      .post("/api/gemini/chat")
      .set("Accept-Language", "en-IN")
      .send({ userInput: "I want to end my life" });

    expect(response.status).toBe(200);
    expect(response.body.riskLevel).toBe("crisis");
  });

  it("still answers an elevated-risk message with music and support", async () => {
    const token = await registerUser();

    // The exact reported failure: this produced a red "Internal Server Error"
    // bubble, discarding the support contacts the user most needed.
    const response = await request(app)
      .post("/api/music/recommend/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept-Language", "en-IN")
      .send({ message: "I feel completely hopeless about everything" });

    expect(response.status).toBe(200);
    expect(response.body.riskLevel).toBe("elevated");
    expect(response.body.recommendations.length).toBeGreaterThan(0);
    expect(response.body.supportResources.length).toBeGreaterThan(0);
    // Says plainly that these are stand-ins rather than a personalised result.
    expect(response.body.curated).toBe(true);
  });
});

describe("region-appropriate helplines", () => {
  it("gives an Indian caller a dialable number, not just a website", async () => {
    const token = await registerUser();

    const response = await request(app)
      .post("/api/music/recommend/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .set("Accept-Language", "en-IN")
      .send({ message: "I want to kill myself" });

    const contacts = response.body.supportResources.map((r) => r.contact);
    // Every crisis panel used to show findahelpline.com and nothing else,
    // because region was never threaded through this path.
    expect(contacts).toContain("14416");
  });

  it("falls back to the international registry for an unknown region", async () => {
    const response = await request(app)
      .post("/api/gemini/analyze-mood")
      .set("Accept-Language", "xx-ZZ")
      .send({ userInput: "I want to kill myself" });

    expect(response.body.supportResources.length).toBeGreaterThan(0);
  });
});

describe("false positives", () => {
  it.each([
    "I ran 5 kms today, need running music",
    "cycled 42 kms this morning",
    "songs for a 15 kms run",
  ])("does not raise a crisis panel for %j", async (message) => {
    const token = await registerUser();

    const response = await request(app)
      .post("/api/music/recommend/recommendations")
      .set("Authorization", `Bearer ${token}`)
      .send({ message });

    // "kms" is kilometres far more often than not, especially in India.
    expect(response.body.riskLevel).toBeUndefined();
    expect(response.body.recommendations.length).toBeGreaterThan(0);
  });
});
