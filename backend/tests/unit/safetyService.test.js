import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/geminiService.js", () => ({
  generateJson: vi.fn(),
  generateText: vi.fn(),
}));

const { generateJson } = await import("../../services/geminiService.js");
const { RISK_LEVELS, assessRisk, buildCrisisResponse } = await import(
  "../../services/safetyService.js"
);

describe("assessRisk", () => {
  beforeEach(() => {
    vi.mocked(generateJson).mockReset();
    vi.mocked(generateJson).mockResolvedValue({ risk: "none" });
  });

  it.each([
    "I want to kill myself",
    "thinking about ending my life",
    "I don't want to be here anymore",
    "everyone would be better off without me",
    "I've been cutting myself again",
    "there's no point in living",
  ])("flags %j as crisis without needing the model", async (message) => {
    const result = await assessRisk(message);

    expect(result.level).toBe(RISK_LEVELS.CRISIS);
    expect(result.resources.length).toBeGreaterThan(0);
    expect(generateJson).not.toHaveBeenCalled();
  });

  it.each(["I feel completely hopeless", "I can't cope anymore", "I feel worthless"])(
    "flags %j as elevated",
    async (message) => {
      const result = await assessRisk(message);
      expect(result.level).toBe(RISK_LEVELS.ELEVATED);
    }
  );

  it.each([
    "play me something upbeat",
    "I'm stressed about exams",
    "feeling a bit sad today",
    "I'm bored, give me 5 songs",
  ])("treats %j as ordinary", async (message) => {
    const result = await assessRisk(message);
    expect(result.level).toBe(RISK_LEVELS.NONE);
  });

  it("escalates via the model when patterns miss the phrasing", async () => {
    vi.mocked(generateJson).mockResolvedValue({ risk: "crisis" });

    const result = await assessRisk("I've decided tonight is the last night");

    expect(result.level).toBe(RISK_LEVELS.CRISIS);
    expect(result.resources.length).toBeGreaterThan(0);
  });

  it("still flags a pattern match when the model is unavailable", async () => {
    vi.mocked(generateJson).mockRejectedValue(new Error("Gemini down"));

    const result = await assessRisk("I want to die");

    expect(result.level).toBe(RISK_LEVELS.CRISIS);
  });

  it("degrades to none, not a crash, when the model fails on unmatched text", async () => {
    vi.mocked(generateJson).mockRejectedValue(new Error("Gemini down"));

    // `degraded` distinguishes an unreachable classifier from a genuine "none".
    // Without it a dead classifier is indistinguishable from a healthy one.
    await expect(assessRisk("recommend jazz")).resolves.toEqual({
      level: RISK_LEVELS.NONE,
      degraded: true,
    });
  });

  it("reports a healthy classifier as not degraded", async () => {
    vi.mocked(generateJson).mockResolvedValue({ risk: "none" });

    await expect(assessRisk("play something upbeat")).resolves.toEqual({
      level: RISK_LEVELS.NONE,
      degraded: false,
    });
  });

  it("never marks a pattern match as degraded, even with the model down", async () => {
    vi.mocked(generateJson).mockRejectedValue(new Error("Gemini down"));

    const result = await assessRisk("I want to die");

    expect(result.level).toBe(RISK_LEVELS.CRISIS);
    expect(result.degraded).toBe(false);
  });

  it("returns region-specific helplines", async () => {
    const india = await assessRisk("I want to die", { region: "IN" });
    expect(india.resources.some((r) => r.contact === "14416")).toBe(true);

    const unknown = await assessRisk("I want to die", { region: "ZZ" });
    expect(unknown.resources.length).toBeGreaterThan(0);
  });

  it("ignores empty input", async () => {
    await expect(assessRisk("")).resolves.toEqual({
      level: RISK_LEVELS.NONE,
      degraded: false,
    });
  });
});

describe("buildCrisisResponse", () => {
  it("returns support instead of songs", () => {
    const response = buildCrisisResponse({
      resources: [{ name: "Tele-MANAS", contact: "14416" }],
      notice: "emergency notice",
    });

    expect(response.recommendations).toEqual([]);
    expect(response.supportResources).toHaveLength(1);
    expect(response.emergencyNotice).toBe("emergency notice");
  });

  it("points to a person rather than offering music", () => {
    const { response } = buildCrisisResponse({ resources: [], notice: "" });

    // The copy may mention a playlist only to say it is not enough here.
    expect(response).toMatch(/reach(ing)? out|someone who can help/i);
    expect(response).not.toMatch(
      /here are some|try (these|listening)|recommend|i've picked/i
    );
  });
});
