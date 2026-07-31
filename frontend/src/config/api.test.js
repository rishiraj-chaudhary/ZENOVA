import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The deployed frontend sets VITE_API_URL without the /api suffix, so
 * normalisation is what stops every request landing on /auth/login instead of
 * /api/auth/login. Modules are re-imported per case because config/api.js reads
 * import.meta.env once at module scope.
 */
const loadConfig = async (env) => {
  vi.resetModules();
  vi.stubEnv("VITE_API_URL", env.VITE_API_URL ?? "");
  vi.stubEnv("PROD", env.PROD ? "true" : "");
  return import("./api.js");
};

afterEach(() => vi.unstubAllEnvs());

describe("API_BASE_URL", () => {
  it.each([
    ["https://api.example.com", "https://api.example.com/api"],
    ["https://api.example.com/", "https://api.example.com/api"],
    ["https://api.example.com/api", "https://api.example.com/api"],
    ["https://api.example.com/api/", "https://api.example.com/api"],
  ])("normalises %s", async (input, expected) => {
    const { API_BASE_URL } = await loadConfig({ VITE_API_URL: input });
    expect(API_BASE_URL).toBe(expected);
  });

  it("falls back to the dev server when unset", async () => {
    const { API_BASE_URL } = await loadConfig({});
    expect(API_BASE_URL).toBe("http://localhost:3000/api");
  });
});

describe("SOCKET_URL", () => {
  it.each([
    ["https://api.example.com", "https://api.example.com"],
    ["https://api.example.com/api", "https://api.example.com"],
    ["https://api.example.com/api/", "https://api.example.com"],
  ])("strips the api path from %s", async (input, expected) => {
    const { SOCKET_URL } = await loadConfig({ VITE_API_URL: input });
    expect(SOCKET_URL).toBe(expected);
  });
});
