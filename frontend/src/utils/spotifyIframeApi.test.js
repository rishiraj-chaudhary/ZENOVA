import { describe, expect, it } from "vitest";
import { isTrackFinished } from "./spotifyIframeApi.js";

const SONG = 200_000; // a 3'20" track, in milliseconds

describe("detecting the end of a track", () => {
  it("fires when the position walks up to the duration", () => {
    expect(
      isTrackFinished({ position: SONG - 500, duration: SONG, isPaused: false }, SONG - 500)
    ).toBe(true);
  });

  it("fires when playback pauses and snaps back to zero after a full play", () => {
    // The other way Spotify reports an end, depending on client and track.
    expect(isTrackFinished({ position: 0, duration: SONG, isPaused: true }, SONG - 200)).toBe(
      true
    );
  });

  it("does not fire part-way through", () => {
    expect(
      isTrackFinished({ position: SONG / 2, duration: SONG, isPaused: false }, SONG / 2)
    ).toBe(false);
  });

  it("does not fire when a user pauses and drags back to the start", () => {
    // Identical to a finished track except that barely any of it played, which
    // is the only thing separating "I restarted this" from "it ended".
    expect(isTrackFinished({ position: 0, duration: SONG, isPaused: true }, 4_000)).toBe(
      false
    );
  });

  it("does not fire on the first update, before anything has played", () => {
    expect(isTrackFinished({ position: 0, duration: SONG, isPaused: true }, 0)).toBe(false);
  });

  it("ignores updates that carry no duration yet", () => {
    expect(isTrackFinished({ position: 0, duration: 0, isPaused: false }, 0)).toBe(false);
    expect(isTrackFinished({ position: 0, duration: undefined, isPaused: true }, 999)).toBe(
      false
    );
  });
});
