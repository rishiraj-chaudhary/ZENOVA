import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { POINTS } from "../../config/gamification.js";
import Gamification from "../../models/Gamification.js";
import MusicResource from "../../models/MusicResource.js";
import Playlist from "../../models/Playlist.js";
import Recommendation from "../../models/Recommendation.js";
import SessionOutcome from "../../models/SessionOutcome.js";
import User from "../../models/user.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const registerUser = async (name = "Auditee") => {
  counter += 1;
  const { body } = await request(app).post("/api/auth/register").send({
    name: `${name}-${counter}`,
    email: `audit-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
  });
  return { token: body.user.token, userId: body.user._id, name: `${name}-${counter}` };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

const consent = (token) =>
  request(app).put("/api/users/consent").set(authed(token)).send({ moodTracking: true });

const makeSong = (title) =>
  MusicResource.create({
    title,
    artist: "A",
    genre: "calm",
    duration: 180,
    audioUrl: `https://example.com/${title}.mp3`,
  });

const createPlaylist = async (token, name = "P") => {
  const { body } = await request(app)
    .post("/api/playlists/create")
    .set(authed(token))
    .send({ name });
  return body.playlist?._id ?? body._id;
};

/** The gamification middleware awards on setImmediate, after the response. */
const settleAwards = () => new Promise((resolve) => setTimeout(resolve, 250));

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("consent gates every mood write, not just check-ins", () => {
  const openSession = async (userId) =>
    (
      await Recommendation.create({
        userId,
        detectedMood: "low",
        recommendedMusic: [],
      })
    )._id;

  it("refuses to record a before-rating without consent", async () => {
    const user = await registerUser();
    const sessionId = await openSession(user.userId);

    const response = await request(app)
      .post("/api/wellbeing/sessions/start")
      .set(authed(user.token))
      .send({ sessionId: sessionId.toString(), moodBefore: 2 });

    // This used to return 201 and persist moodBefore for a user who had never
    // consented to mood tracking.
    expect(response.status).toBe(403);
    expect(await SessionOutcome.countDocuments({})).toBe(0);
  });

  it("refuses to record an after-rating without consent", async () => {
    const user = await registerUser();
    const sessionId = await openSession(user.userId);
    await SessionOutcome.create({ userId: user.userId, sessionId, moodBefore: 2 });

    const response = await request(app)
      .post("/api/wellbeing/sessions/complete")
      .set(authed(user.token))
      .send({ sessionId: sessionId.toString(), moodAfter: 5 });

    expect(response.status).toBe(403);
    expect((await SessionOutcome.findOne({ sessionId })).moodAfter).toBeUndefined();
  });

  it("allows both once consent is given", async () => {
    const user = await registerUser();
    await consent(user.token);
    const sessionId = await openSession(user.userId);

    const start = await request(app)
      .post("/api/wellbeing/sessions/start")
      .set(authed(user.token))
      .send({ sessionId: sessionId.toString(), moodBefore: 2 });
    const done = await request(app)
      .post("/api/wellbeing/sessions/complete")
      .set(authed(user.token))
      .send({ sessionId: sessionId.toString(), moodAfter: 5 });

    expect(start.status).toBeLessThan(300);
    expect(done.status).toBe(200);
    expect(done.body.delta).toBe(3);
  });

  it("says so rather than reporting success for a check-in it did not save", async () => {
    const user = await registerUser();

    const response = await request(app)
      .post("/api/wellbeing/moods")
      .set(authed(user.token))
      .send({ mood: "calm", intensity: 4 });

    // 201 with a null body claimed the check-in was saved when nothing was.
    expect(response.status).toBe(403);
  });
});

describe("points are keyed to the thing that earned them", () => {
  it("pays for every song added to a playlist, not just the first", async () => {
    const user = await registerUser();
    const playlistId = await createPlaylist(user.token);

    for (const title of ["one", "two", "three"]) {
      const song = await makeSong(title);
      await request(app)
        .post("/api/playlists/addsong")
        .set(authed(user.token))
        .send({ playlistId, songId: song._id.toString() });
      await settleAwards();
    }

    // The entity key was the playlist id — /addsong responds with the playlist —
    // so songs two and three were treated as duplicate awards and paid nothing.
    const stats = await Gamification.findOne({ userId: user.userId });
    expect(stats.songsAdded).toBe(3);
    expect(stats.totalPoints).toBe(
      POINTS.PLAYLIST_CREATED + POINTS.SONG_ADDED * 3
    );
  });

  it("still refuses to pay twice for the same song", async () => {
    const user = await registerUser();
    const playlistId = await createPlaylist(user.token);
    const song = await makeSong("repeat");

    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post("/api/playlists/addsong")
        .set(authed(user.token))
        .send({ playlistId, songId: song._id.toString() });
      await settleAwards();
    }

    expect((await Gamification.findOne({ userId: user.userId })).songsAdded).toBe(1);
  });
});

describe("collaboration does not leak or over-share", () => {
  it("does not disclose collaborators' email addresses", async () => {
    const owner = await registerUser("Owner");
    const other = await registerUser("Other");
    const playlistId = await createPlaylist(owner.token);
    await Playlist.updateOne(
      { _id: playlistId },
      { $addToSet: { collaborators: other.userId } }
    );

    const { body } = await request(app)
      .get(`/api/playlists/${playlistId}/collaborators`)
      .set(authed(owner.token));

    expect(body.collaborators).toHaveLength(1);
    expect(body.collaborators[0].name).toBeTruthy();
    // Joining any shared playlist used to disclose everyone else's address.
    expect(body.collaborators[0].email).toBeUndefined();
  });

  it("revokes the invite link when a collaborator is removed", async () => {
    const owner = await registerUser("Owner");
    const removed = await registerUser("Removed");
    const playlistId = await createPlaylist(owner.token);
    await Playlist.updateOne(
      { _id: playlistId },
      { $addToSet: { collaborators: removed.userId } }
    );

    const before = (await Playlist.findById(playlistId)).inviteLink.code;

    await request(app)
      .delete(`/api/playlists/${playlistId}/collaborators/${removed.userId}`)
      .set(authed(owner.token));

    // Removal only appeared to work: anyone still holding the URL — the person
    // just removed, most obviously — could re-join with one request.
    const after = (await Playlist.findById(playlistId)).inviteLink.code;
    expect(after).not.toBe(before);

    const rejoin = await request(app)
      .get(`/api/playlists/invite/accept/${before}`)
      .set(authed(removed.token));

    expect(rejoin.status).toBe(404);
    expect((await Playlist.findById(playlistId)).collaborators).toHaveLength(0);
  });

  it("issues a working link when the QR is generated for an expired one", async () => {
    const owner = await registerUser("Owner");
    const joiner = await registerUser("Joiner");
    const playlistId = await createPlaylist(owner.token);

    await Playlist.updateOne(
      { _id: playlistId },
      { $set: { "inviteLink.expiresAt": new Date(Date.now() - 1000) } }
    );

    const { body } = await request(app)
      .post(`/api/playlists/invite/qr/${playlistId}`)
      .set(authed(owner.token));

    expect(body.qrCode).toMatch(/^data:image\/png/);

    // The QR reused the stored code without checking it was still valid, so it
    // scanned to "Invalid or expired invitation link".
    const code = body.inviteLink.split("/").pop();
    const accepted = await request(app)
      .get(`/api/playlists/invite/accept/${code}`)
      .set(authed(joiner.token));

    expect(accepted.status).toBe(200);
  });
});

describe("signing out everywhere actually signs out everywhere", () => {
  it("destroys sessions as well as refresh tokens", async () => {
    const { destroySessionsForUser } = await import(
      "../../services/sessionStoreService.js"
    );
    const user = await registerUser();

    const mongoose = (await import("mongoose")).default;
    await mongoose.connection.collection("sessions").insertOne({
      _id: "test-session",
      session: JSON.stringify({ user: { _id: user.userId } }),
      expires: new Date(Date.now() + 60_000),
    });

    const destroyed = await destroySessionsForUser(user.userId);

    // authMiddleware accepts an express session as credentials in its own right,
    // so revoking refresh tokens alone left other devices signed in.
    expect(destroyed).toBe(1);
    expect(
      await mongoose.connection.collection("sessions").countDocuments({})
    ).toBe(0);
  });
});

describe("socket handlers survive malformed payloads", () => {
  it("does not throw when join_playlist arrives with no argument", async () => {
    const { default: SocketManager } = await import(
      "../../services/socketManager.js"
    );

    const handlers = {};
    const socket = {
      id: "s1",
      data: { userId: (await registerUser()).userId, username: "x" },
      join: vi.fn(),
      leave: vi.fn(),
      emit: vi.fn(),
      on: (event, handler) => {
        handlers[event] = handler;
      },
    };

    const io = {
      on: (event, handler) => {
        if (event === "connection") handler(socket);
      },
      to: () => ({ emit: vi.fn() }),
      sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
    };

    new SocketManager(io);

    // `socket.emit("join_playlist")` from any browser console used to throw a
    // TypeError inside socket.io's dispatch, which has no try/catch, ending the
    // process and every other user's session with it.
    await expect(handlers.join_playlist(undefined)).resolves.not.toThrow();
    expect(() => handlers.leave_playlist(undefined)).not.toThrow();
    expect(socket.emit).toHaveBeenCalledWith("join_denied", { playlistId: undefined });
  });
});

describe("Spotify OAuth state fails closed", () => {
  it("rejects a callback carrying no session state", async () => {
    const response = await request(app)
      .get("/api/music/recommend/spotify/callback")
      .query({ code: "attacker-code", state: "anything" });

    // The check ran only "when a state was issued", so omitting the session
    // cookie skipped it entirely and exchanged the attacker's code.
    expect(response.status).toBe(400);
  });

  it("rejects a callback with no state at all", async () => {
    const response = await request(app)
      .get("/api/music/recommend/spotify/callback")
      .query({ code: "attacker-code" });

    expect(response.status).toBe(400);
  });
});

describe("prompts see the most recent moods, in order", () => {
  it("takes the newest five and reads chronologically", async () => {
    const { buildConversationalPrompt } = await import(
      "../../prompts/conversationPrompt.js"
    );

    // As moodService returns it: newest first.
    const moodHistory = [
      { mood: "great" },
      { mood: "good" },
      { mood: "okay" },
      { mood: "low" },
      { mood: "awful" },
      { mood: "ancient-1" },
      { mood: "ancient-2" },
    ];

    const prompt = buildConversationalPrompt("hi", [], { moodHistory });

    // slice(-5) took the OLDEST five and printed them backwards.
    expect(prompt).toContain("awful → low → okay → good → great");
    expect(prompt).not.toContain("ancient-1");
  });
});
