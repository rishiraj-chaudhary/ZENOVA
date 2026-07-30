import { describe, expect, it } from "vitest";
import { calculateLevel } from "../../services/pointsService.js";
import parseRequestedSongCount, {
  DEFAULT_SONG_COUNT,
} from "../../utils/parseRequestedSongCount.js";
import parseVoicePlaylistCommand from "../../utils/parseVoicePlaylistCommand.js";

describe("parseRequestedSongCount", () => {
  it.each([
    ["play something sad", DEFAULT_SONG_COUNT],
    ["give me 3 songs", 3],
    ["I want 8 tracks for the gym", 8],
    ["seven songs please", 7],
    ["a couple of songs", 2],
    ["a few tracks", 4],
    ["several songs", 6],
    ["lots of songs", 8],
  ])("parses %j as %i", (input, expected) => {
    expect(parseRequestedSongCount(input)).toBe(expected);
  });

  it("clamps unreasonable requests", () => {
    expect(parseRequestedSongCount("500 songs")).toBe(15);
    expect(parseRequestedSongCount("0 songs")).toBe(1);
  });

  it("handles empty input", () => {
    expect(parseRequestedSongCount()).toBe(DEFAULT_SONG_COUNT);
    expect(parseRequestedSongCount("")).toBe(DEFAULT_SONG_COUNT);
  });
});

describe("parseVoicePlaylistCommand", () => {
  it.each([
    ["create a playlist called Morning Calm", "Morning Calm"],
    ["make a new playlist named Deep Focus", "Deep Focus"],
    ["create a playlist titled Late Night Drive.", "Late Night Drive"],
    ["make a workout playlist", "workout playlist"],
  ])("extracts the name from %j", (command, expected) => {
    expect(parseVoicePlaylistCommand(command).name).toBe(expected);
  });

  it.each([
    ["make a workout playlist", "workout"],
    ["create a chill relaxing playlist", "relaxation"],
    ["build me a study playlist", "focus"],
    ["party playlist please", "party"],
  ])("detects the type in %j", (command, expected) => {
    expect(parseVoicePlaylistCommand(command).type).toBe(expected);
  });

  it("falls back to a default name for unusable input", () => {
    expect(parseVoicePlaylistCommand("hi").name).toBe("My Playlist");
  });

  it("returns a null type when nothing matches", () => {
    expect(parseVoicePlaylistCommand("create a playlist called Zed").type).toBeNull();
  });
});

describe("calculateLevel", () => {
  it.each([
    [0, 1],
    [39, 1],
    [40, 2],
    [499, 2],
    [500, 3],
    [1500, 4],
    [5000, 5],
    [999999, 5],
  ])("maps %i points to level %i", (points, expected) => {
    expect(calculateLevel(points)).toBe(expected);
  });
});
