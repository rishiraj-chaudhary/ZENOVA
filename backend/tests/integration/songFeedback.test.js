import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import ListeningFeedback from "../../models/ListeningFeedback.js";
import MusicResource from "../../models/MusicResource.js";
import { buildTasteProfile, getSkippedSongTitles } from "../../services/tasteService.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const registerUser = async () => {
  counter += 1;
  const { body } = await request(app).post("/api/auth/register").send({
    name: `Rater-${counter}`,
    email: `rater-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
  });
  return { token: body.user.token, userId: body.user._id };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

const makeSong = (title, genre = "lo-fi") =>
  MusicResource.create({
    title,
    artist: "Someone",
    genre,
    duration: 180,
    audioUrl: `https://example.com/${title}.mp3`,
  });

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("rating a song", () => {
  it("accepts a rating with no open session", async () => {
    const user = await registerUser();
    const song = await makeSong("Standalone");

    // The UI holds sessionId and moodAtTime in state and sends them straight
    // through, so both are null on the playlist page and before a mood is
    // detected. express-validator's bare .optional() only skips `undefined`, so
    // every rating outside an open session was rejected with a 400 — and the
    // component reverts quietly on failure, so the thumb just flicked back.
    const response = await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(user.token))
      .send({ musicId: song._id.toString(), signal: "liked", sessionId: null, moodAtTime: null });

    expect(response.status).toBe(201);
    expect(await ListeningFeedback.countDocuments({ userId: user.userId })).toBe(1);
  });

  it("still rejects a sessionId that is present but malformed", async () => {
    const user = await registerUser();
    const song = await makeSong("Guarded");

    const response = await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(user.token))
      .send({ musicId: song._id.toString(), signal: "liked", sessionId: "not-an-id" });

    expect(response.status).toBe(400);
  });

  it("keeps one standing opinion per song", async () => {
    const user = await registerUser();
    const song = await makeSong("Changeable");

    const rate = (signal) =>
      request(app)
        .post("/api/wellbeing/feedback")
        .set(authed(user.token))
        .send({ musicId: song._id.toString(), signal });

    await rate("liked");
    await rate("skipped");

    const rows = await ListeningFeedback.find({ userId: user.userId });
    expect(rows).toHaveLength(1);
    expect(rows[0].signal).toBe("skipped");
  });

  it("hands back the user's ratings so the buttons can show them", async () => {
    const user = await registerUser();
    const liked = await makeSong("Kept");
    const skipped = await makeSong("Dropped");

    for (const [song, signal] of [[liked, "liked"], [skipped, "skipped"]]) {
      await request(app)
        .post("/api/wellbeing/feedback")
        .set(authed(user.token))
        .send({ musicId: song._id.toString(), signal });
    }

    const { body } = await request(app)
      .get("/api/wellbeing/feedback")
      .set(authed(user.token));

    // Nothing exposed these, so every reload came back blank and a saved
    // rating looked like a failed one.
    expect(body.signals[liked._id.toString()]).toBe("liked");
    expect(body.signals[skipped._id.toString()]).toBe("skipped");
  });

  it("shows one user nothing of another's ratings", async () => {
    const mine = await registerUser();
    const theirs = await registerUser();
    const song = await makeSong("Private");

    await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(theirs.token))
      .send({ musicId: song._id.toString(), signal: "liked" });

    const { body } = await request(app)
      .get("/api/wellbeing/feedback")
      .set(authed(mine.token));

    expect(body.signals).toEqual({});
  });
});

describe("ratings reach the recommendation prompt", () => {
  it("becomes a liked genre the prompt can state", async () => {
    const user = await registerUser();
    const song = await makeSong("Warm", "ambient");

    await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(user.token))
      .send({ musicId: song._id.toString(), signal: "liked" });

    const taste = await buildTasteProfile(user.userId);
    expect(taste.likedGenres).toContain("ambient");
    expect(taste.totalSignals).toBe(1);
  });

  it("becomes an avoid-list entry when skipped", async () => {
    const user = await registerUser();
    const song = await makeSong("Grating", "hardstyle");

    await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(user.token))
      .send({ musicId: song._id.toString(), signal: "skipped" });

    // The point of a thumbs-down: this song stops being suggested.
    // Titles come back as "Title — Artist", which is what the prompt shows.
    expect(await getSkippedSongTitles(user.userId)).toEqual(["Grating — Someone"]);

    const taste = await buildTasteProfile(user.userId);
    expect(taste.skippedGenres).toContain("hardstyle");
  });

  it("stops counting once the rating is removed", async () => {
    const user = await registerUser();
    const song = await makeSong("Undone", "jazz");

    await request(app)
      .post("/api/wellbeing/feedback")
      .set(authed(user.token))
      .send({ musicId: song._id.toString(), signal: "liked" });

    await request(app)
      .delete(`/api/wellbeing/feedback/${song._id}`)
      .set(authed(user.token));

    expect((await buildTasteProfile(user.userId)).totalSignals).toBe(0);
  });
});
