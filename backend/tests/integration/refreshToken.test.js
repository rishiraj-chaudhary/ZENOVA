import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import RefreshToken from "../../models/RefreshToken.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const credentials = () => ({
  name: "Refresh Tester",
  email: `refresh-${(counter += 1)}-${Date.now()}@example.com`,
  password: "hunter2secure",
});

const registerUser = async () => {
  const { body } = await request(app).post("/api/auth/register").send(credentials());
  return body;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("token issuance", () => {
  it("returns an access token and sets an httpOnly refresh cookie", async () => {
    const response = await request(app).post("/api/auth/register").send(credentials());

    expect(response.body.user.token).toBeTruthy();

    const cookie = response.headers["set-cookie"]?.find((c) =>
      c.startsWith("zenova_refresh=")
    );
    expect(cookie).toBeDefined();
    expect(cookie).toContain("HttpOnly");
  });

  it("stores only a hash of the refresh token", async () => {
    const { refreshToken } = await registerUser();

    const stored = await RefreshToken.findOne({});
    expect(stored.tokenHash).not.toBe(refreshToken);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("rotation", () => {
  it("issues a new access token and rotates the refresh token", async () => {
    const { refreshToken } = await registerUser();

    const response = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    expect(response.status).toBe(200);
    expect(response.body.user.token).toBeTruthy();
    expect(response.body.refreshToken).not.toBe(refreshToken);
  });

  it("rejects the previous token once rotated", async () => {
    const { refreshToken } = await registerUser();

    await request(app).post("/api/auth/refresh").send({ refreshToken });

    const replay = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(replay.status).toBe(401);
  });

  it("revokes the whole family when a used token is replayed", async () => {
    const { refreshToken } = await registerUser();

    const { body: rotated } = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken });

    // Replaying the old token means it was either stolen or leaked, so the
    // current token must stop working too rather than letting an attacker ride
    // the live chain.
    await request(app).post("/api/auth/refresh").send({ refreshToken });

    const afterCompromise = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: rotated.refreshToken });

    expect(afterCompromise.status).toBe(401);
  });

  it("rejects an unknown token", async () => {
    const response = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "not-a-real-token" });

    expect(response.status).toBe(401);
  });

  it("rejects a missing token", async () => {
    const response = await request(app).post("/api/auth/refresh").send({});
    expect(response.status).toBe(401);
  });
});

describe("logout", () => {
  it("revokes the presented token", async () => {
    const { refreshToken } = await registerUser();

    await request(app).post("/api/auth/logout").send({ refreshToken });

    const response = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(response.status).toBe(401);
  });

  it("signs out every device", async () => {
    const { user, refreshToken } = await registerUser();

    const { body: second } = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "hunter2secure" });

    await request(app)
      .post("/api/auth/logout-all")
      .set("Authorization", `Bearer ${second.user.token}`);

    for (const token of [refreshToken, second.refreshToken]) {
      const response = await request(app).post("/api/auth/refresh").send({
        refreshToken: token,
      });
      expect(response.status).toBe(401);
    }
  });
});

describe("access token lifetime", () => {
  it("is short-lived", async () => {
    const { user } = await registerUser();

    const [, payload] = user.token.split(".");
    const { exp, iat } = JSON.parse(Buffer.from(payload, "base64url").toString());

    // A long-lived access token is what made an XSS a month-long takeover.
    expect(exp - iat).toBeLessThanOrEqual(60 * 60);
  });
});
