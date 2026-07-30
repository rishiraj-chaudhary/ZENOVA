import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import User from "../../models/user.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

const VALID_USER = {
  name: "Test User",
  email: "test@example.com",
  password: "hunter2secure",
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("POST /api/auth/register", () => {
  it("creates an account and returns a token", async () => {
    const response = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.email).toBe(VALID_USER.email);
  });

  it("never returns the password hash", async () => {
    const response = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("stores the password hashed, not in plain text", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);

    const stored = await User.findOne({ email: VALID_USER.email }).select("+password");

    expect(stored.password).not.toBe(VALID_USER.password);
    expect(stored.password).toMatch(/^\$2[aby]\$/);
  });

  it.each([
    [{ ...VALID_USER, email: "not-an-email" }, "invalid email"],
    [{ ...VALID_USER, password: "short" }, "short password"],
    [{ ...VALID_USER, name: "" }, "missing name"],
  ])("rejects %#: %s", async (payload) => {
    const response = await request(app).post("/api/auth/register").send(payload);
    expect(response.status).toBe(400);
  });

  it("rejects a duplicate email", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);
    const response = await request(app).post("/api/auth/register").send(VALID_USER);

    expect(response.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  beforeAll(async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);
  });

  it("returns a token for valid credentials", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password });

    expect(response.status).toBe(200);
    expect(response.body.user.token).toBeTruthy();
  });

  it("gives an identical error for unknown email and wrong password", async () => {
    await request(app).post("/api/auth/register").send(VALID_USER);

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "wrongpassword" });

    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: VALID_USER.password });

    // Differing responses would let an attacker enumerate registered accounts.
    expect(wrongPassword.status).toBe(unknownEmail.status);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe("authorization", () => {
  it.each([
    ["get", "/api/users/profile"],
    ["get", "/api/playlists/my-playlists"],
    ["get", "/api/gamification/stats"],
    ["get", "/api/wellbeing/insights"],
    ["get", "/api/privacy/export"],
  ])("rejects unauthenticated %s %s", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
  });

  it("rejects a malformed token", async () => {
    const response = await request(app)
      .get("/api/users/profile")
      .set("Authorization", "Bearer not.a.real.token");

    expect(response.status).toBe(401);
  });

  it("leaks no stack trace in error responses", async () => {
    const response = await request(app).get("/api/users/profile");

    expect(response.body.stack).toBeUndefined();
    expect(response.body).toHaveProperty("message");
  });
});
