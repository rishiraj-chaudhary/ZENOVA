import { afterEach, describe, expect, it, vi } from "vitest";
import logger from "../../utils/logger.js";

/**
 * The suite runs at LOG_LEVEL=error, so assertions go through logger.error.
 * All levels share the same emit path, so redaction and metadata normalisation
 * are covered regardless of which one is used.
 */
const capture = () => {
  const lines = [];
  vi.spyOn(console, "error").mockImplementation((line) => lines.push(line));
  return lines;
};

afterEach(() => vi.restoreAllMocks());

describe("logger metadata handling", () => {
  it("does not explode a string into indexed characters", () => {
    const lines = capture();

    logger.error("something failed", "connection refused");

    // A bare `...meta` on a string would emit {"0":"c","1":"o",...}.
    expect(lines[0]).not.toMatch(/"0":/);
    expect(lines[0]).toContain("connection refused");
  });

  it("keeps an Error's message", () => {
    const lines = capture();

    logger.error("boom", new Error("kaboom"));

    expect(lines[0]).toContain("kaboom");
  });

  it("passes a plain object through", () => {
    const lines = capture();

    logger.error("request failed", { status: 500 });

    expect(lines[0]).toContain("500");
  });

  it("handles no metadata at all", () => {
    const lines = capture();

    logger.error("plain message");

    expect(lines[0]).toContain("plain message");
  });
});

describe("logger redaction", () => {
  it("never emits mood text or credentials", () => {
    const lines = capture();

    logger.error("check-in failed", {
      mood: "hopeless",
      context: "a private sentence about my week",
      token: "eyJhbGciOi",
      password: "hunter2",
      userId: "abc123",
    });

    const line = lines[0];
    expect(line).not.toContain("hopeless");
    expect(line).not.toContain("private sentence");
    expect(line).not.toContain("eyJhbGciOi");
    expect(line).not.toContain("hunter2");
    // Non-sensitive fields still come through, or the logs would be useless.
    expect(line).toContain("abc123");
  });

  it("redacts nested credentials too", () => {
    const lines = capture();

    logger.error("upstream failed", { request: { headers: { authorization: "Bearer x" } } });

    expect(lines[0]).not.toContain("Bearer x");
  });
});
