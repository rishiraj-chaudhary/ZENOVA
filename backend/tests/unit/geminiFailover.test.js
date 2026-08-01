import { beforeEach, describe, expect, it, vi } from "vitest";

/** Records which models were attempted, in order. */
const attempted = [];

/**
 * A 404 from a retired model — non-retryable. The first candidate always fails
 * this way; every later one succeeds.
 */
const generateContent = vi.fn(async () => {
  const model = attempted[attempted.length - 1];
  if (model === "primary-retired") {
    const error = Object.assign(new Error("model not found"), { status: 404 });
    throw error;
  }
  return { response: { text: () => "ok" }, usageMetadata: {} };
});

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel({ model }) {
      attempted.push(model);
      return { generateContent };
    }
  },
}));

vi.mock("../../config/environment.js", () => ({
  default: {
    gemini: {
      apiKey: "test-key",
      model: "primary-retired",
      fallbackModels: ["fallback-a", "fallback-b"],
    },
  },
}));

const { generateText } = await import("../../services/geminiService.js");

beforeEach(() => {
  attempted.length = 0;
  generateContent.mockClear();
});

describe("model failover", () => {
  it("tries the next model when one is retired", async () => {
    // `if (!isRetryable(error)) throw error` aborted the whole chain, so when
    // gemini-2.0-flash was retired its 404 took the feature down instead of
    // moving to the next candidate — the fallback list was decorative.
    await expect(generateText("hello")).resolves.toBe("ok");

    expect(attempted[0]).toBe("primary-retired");
    expect(attempted).toContain("fallback-a");
    // Tried once, not RETRIES_PER_MODEL times: a 404 will not become a 200.
    expect(attempted.filter((model) => model === "primary-retired")).toHaveLength(1);
  });

  it("cools the failed model down instead of retrying it", async () => {
    // The first test already exercised the failure, and the unhealthy marker is
    // module state shared across tests — which is exactly the behaviour being
    // asserted: the retired model is not offered again.
    await expect(generateText("again")).resolves.toBe("ok");
    expect(attempted).not.toContain("primary-retired");
  });
});
