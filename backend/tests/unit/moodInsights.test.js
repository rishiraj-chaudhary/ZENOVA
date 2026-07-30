import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/geminiService.js", () => ({
  generateJson: vi.fn(),
  generateText: vi.fn(),
}));

const { valenceOf, generateInsightNarrative } = await import(
  "../../services/moodInsightsService.js"
);
const { generateJson } = await import("../../services/geminiService.js");
const { currentPeriod } = await import("../../services/leaderboardService.js");

describe("valenceOf", () => {
  it("scores positive moods above neutral and negative below", () => {
    expect(valenceOf("happy")).toBeGreaterThan(0);
    expect(valenceOf("neutral")).toBe(0);
    expect(valenceOf("sad")).toBeLessThan(0);
  });

  it("is case-insensitive", () => {
    expect(valenceOf("ANXIOUS")).toBe(valenceOf("anxious"));
  });

  it("scores unknown moods as neutral rather than dropping them", () => {
    expect(valenceOf("zorbled")).toBe(0);
    expect(valenceOf(undefined)).toBe(0);
  });
});

describe("generateInsightNarrative", () => {
  it("returns null rather than a hollow summary when data is thin", async () => {
    const narrative = await generateInsightNarrative({ hasEnoughData: false });

    expect(narrative).toBeNull();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("degrades to null when the model fails", async () => {
    vi.mocked(generateJson).mockRejectedValue(new Error("Gemini down"));

    const narrative = await generateInsightNarrative({
      hasEnoughData: true,
      totalEntries: 10,
      periodDays: 30,
      topMoods: [{ mood: "calm", count: 5 }],
      moodByTimeOfDay: {},
      moodByDayOfWeek: {},
      topGenres: [],
      efficacy: { measuredSessions: 0, improvedSessions: 0 },
      trend: "steady",
    });

    expect(narrative).toBeNull();
  });
});

describe("currentPeriod", () => {
  it("formats a monthly key", () => {
    expect(currentPeriod("monthly", new Date("2026-03-15T00:00:00Z"))).toBe("2026-03");
  });

  it("formats an ISO weekly key", () => {
    expect(currentPeriod("weekly", new Date("2026-01-08T00:00:00Z"))).toMatch(
      /^\d{4}-W\d{2}$/
    );
  });

  it("uses a constant key for all-time", () => {
    expect(currentPeriod("alltime")).toBe("all");
  });
});
