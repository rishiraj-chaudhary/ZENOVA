import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("axios", () => ({ default: { get } }));

const { findPreviewUrl } = await import("../../services/previewService.js");

const itunesResult = (overrides = {}) => ({
  trackName: "Weightless",
  artistName: "Marconi Union",
  previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
  ...overrides,
});

beforeEach(() => {
  get.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("resolving a 30-second preview", () => {
  it("finds a preview Spotify no longer publishes", async () => {
    get.mockResolvedValue({ data: { results: [itunesResult()] } });

    // Spotify stopped returning preview_url, which left every song in the
    // catalogue with a null preview and a dead audio control.
    await expect(findPreviewUrl("Weightless", "Marconi Union")).resolves.toBe(
      "https://audio-ssl.itunes.apple.com/preview.m4a"
    );
  });

  it("refuses a result whose artist does not match", async () => {
    get.mockResolvedValue({
      data: {
        results: [
          itunesResult({ trackName: "Wrong Artist", artistName: "Somebody Else" }),
        ],
      },
    });

    // Worse than no preview: the user hears the wrong song and blames the
    // recommendation.
    await expect(findPreviewUrl("Wrong Artist", "Marconi Union")).resolves.toBeNull();
  });

  it("refuses a result whose title does not match", async () => {
    get.mockResolvedValue({
      data: {
        results: [
          itunesResult({ trackName: "A Completely Different Song", artistName: "Band B" }),
        ],
      },
    });

    await expect(findPreviewUrl("Wrong Title", "Band B")).resolves.toBeNull();
  });

  it("looks past punctuation and bracketed suffixes", async () => {
    get.mockResolvedValue({
      data: {
        results: [
          itunesResult({
            trackName: "Bracketed (Remastered 2023)",
            artistName: "Band C",
            previewUrl: "ok",
          }),
        ],
      },
    });

    await expect(findPreviewUrl("Bracketed", "Band C")).resolves.toBe("ok");
  });

  it("skips a matching track that has no preview", async () => {
    get.mockResolvedValue({
      data: {
        results: [
          itunesResult({ trackName: "Skipper", artistName: "Band D", previewUrl: null }),
          itunesResult({
            trackName: "Skipper",
            artistName: "Band D",
            previewUrl: "second-one-works",
          }),
        ],
      },
    });

    await expect(findPreviewUrl("Skipper", "Band D")).resolves.toBe(
      "second-one-works"
    );
  });

  it("returns null rather than throwing when the lookup fails", async () => {
    get.mockRejectedValue(new Error("ETIMEDOUT"));

    // A missing preview is a missing nicety; it must never fail the
    // recommendation it was attached to.
    await expect(findPreviewUrl("Anything", "Anyone")).resolves.toBeNull();
  });

  it("does not cache a failure, so a timeout can be retried", async () => {
    get.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    get.mockResolvedValueOnce({
      data: { results: [itunesResult({ trackName: "Retry", artistName: "Band" })] },
    });

    await findPreviewUrl("Retry", "Band");
    await expect(findPreviewUrl("Retry", "Band")).resolves.toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("caches a resolved lookup so a burst hits iTunes once", async () => {
    get.mockResolvedValue({
      data: { results: [itunesResult({ trackName: "Cached", artistName: "Band" })] },
    });

    await findPreviewUrl("Cached", "Band");
    await findPreviewUrl("Cached", "Band");
    await findPreviewUrl("Cached", "Band");

    // iTunes rate-limits at roughly 20 requests a minute.
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("caches a confirmed absence too", async () => {
    get.mockResolvedValue({ data: { results: [] } });

    await findPreviewUrl("Obscure", "Nobody");
    await findPreviewUrl("Obscure", "Nobody");

    expect(get).toHaveBeenCalledTimes(1);
  });

  it("does not call out at all without both a title and an artist", async () => {
    await expect(findPreviewUrl("", "Band")).resolves.toBeNull();
    await expect(findPreviewUrl("Song", "")).resolves.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
});
