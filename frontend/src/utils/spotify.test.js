import { describe, expect, it } from "vitest";
import { extractSpotifyTrackId } from "./spotify.js";

describe("extractSpotifyTrackId", () => {
  it.each([
    ["spotify:track:4cOdK2wGLETKBW3PvgPWqT", "4cOdK2wGLETKBW3PvgPWqT"],
    ["https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", "4cOdK2wGLETKBW3PvgPWqT"],
    [
      "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123",
      "4cOdK2wGLETKBW3PvgPWqT",
    ],
    ["4cOdK2wGLETKBW3PvgPWqT", "4cOdK2wGLETKBW3PvgPWqT"],
  ])("extracts from %s", (input, expected) => {
    expect(extractSpotifyTrackId(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["not-a-track"],
    ["https://youtube.com/watch?v=abc"],
    [12345],
  ])("returns null for %s", (input) => {
    expect(extractSpotifyTrackId(input)).toBeNull();
  });
});
