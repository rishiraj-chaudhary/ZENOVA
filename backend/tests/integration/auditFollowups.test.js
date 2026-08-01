import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BADGES } from "../../config/gamification.js";
import { Badge } from "../../models/Badge.js";
import ListeningFeedback from "../../models/ListeningFeedback.js";
import Playlist from "../../models/Playlist.js";
import PlaylistInvitation from "../../models/PlaylistInvitation.js";
import PointAward from "../../models/PointAward.js";
import RefreshToken from "../../models/RefreshToken.js";
import User from "../../models/user.js";
import { initializeDefaultBadges } from "../../services/badgeService.js";
import { awardPoints } from "../../services/pointsService.js";
import { deleteAccount } from "../../services/privacyService.js";
import parseRequestedSongCount from "../../utils/parseRequestedSongCount.js";
import parseVoicePlaylistCommand from "../../utils/parseVoicePlaylistCommand.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const registerUser = async (name = "User") => {
  counter += 1;
  const { body } = await request(app).post("/api/auth/register").send({
    name: `${name}-${counter}`,
    email: `follow-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
  });
  return { token: body.user.token, userId: body.user._id, name: `${name}-${counter}` };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

const createPlaylist = async (token, name = "P") => {
  const { body } = await request(app)
    .post("/api/playlists/create")
    .set(authed(token))
    .send({ name });
  return body.playlist?._id ?? body._id;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("understanding what the user asked for", () => {
  it("reads a count through the words describing the music", () => {
    // Requiring the number to touch the noun meant any adjective discarded it.
    expect(parseRequestedSongCount("give me 3 calming songs")).toBe(3);
    expect(parseRequestedSongCount("four sad piano tracks")).toBe(4);
    expect(parseRequestedSongCount("seven sad tracks")).toBe(7);
  });

  it("does not find a quantity inside an unrelated word", () => {
    // "Germany" contains "many", and a bare substring test served eight songs.
    expect(parseRequestedSongCount("I miss Germany")).toBe(5);
    expect(parseRequestedSongCount("play something from Germany")).toBe(5);
    expect(parseRequestedSongCount("give me many songs")).toBe(8);
  });

  it("names a voice playlist after the subject, not the pronoun", () => {
    // "make me a playlist for studying" produced a playlist called
    // "me a playlist".
    expect(parseVoicePlaylistCommand("make me a playlist for studying").name).toBe(
      "studying"
    );
    expect(
      parseVoicePlaylistCommand("create me a new playlist for rainy days").name
    ).toBe("rainy days");
    expect(parseVoicePlaylistCommand("make a playlist called Late Nights").name).toBe(
      "Late Nights"
    );
    expect(parseVoicePlaylistCommand("make a playlist").name).toBe("My Playlist");
  });
});

describe("the badge catalogue tracks its config", () => {
  it("applies edits to badges that already exist", async () => {
    await Badge.create({
      name: BADGES[0].name,
      description: "an old description nobody wrote any more",
      icon: BADGES[0].icon,
      requirement: BADGES[0].requirement,
      category: BADGES[0].category,
      rarity: BADGES[0].rarity,
      isActive: true,
    });

    await initializeDefaultBadges();

    // $setOnInsert made the catalogue write-once, so every later edit was
    // silently discarded on any database that had been seeded before.
    const seeded = await Badge.findOne({ name: BADGES[0].name });
    expect(seeded.description).toBe(BADGES[0].description);
  });

  it("deactivates a badge that has been dropped from the config", async () => {
    await Badge.create({
      name: "Retired Badge",
      description: "no longer offered",
      icon: "fa-solid fa-star",
      requirement: { type: "playlist_count", value: 1 },
      category: "creation",
      rarity: "common",
      isActive: true,
    });

    await initializeDefaultBadges();

    const retired = await Badge.findOne({ name: "Retired Badge" });
    expect(retired.isActive).toBe(false);
  });

  it("keeps every configured badge reachable from the progress snapshot", async () => {
    await initializeDefaultBadges();

    const { default: Gamification } = await import("../../models/Gamification.js");
    const user = await registerUser();
    await Gamification.create({ userId: user.userId });

    const { checkAndAwardBadges } = await import("../../services/badgeService.js");
    await checkAndAwardBadges(user.userId, null);

    // A requirement type the snapshot does not compute makes its badge
    // permanently unearnable; this asserts none exists.
    const snapshotTypes = new Set([
      "playlist_count",
      "streak_days",
      "playlists_shared",
      "daily_logins",
      "songs_added",
      "measured_sessions",
      "therapy_sessions",
      "check_in_days",
    ]);

    for (const badge of BADGES) {
      expect(snapshotTypes.has(badge.requirement.type)).toBe(true);
    }
  });
});

describe("deleting an account removes everything keyed to it", () => {
  it("leaves no award ledger, refresh tokens or invitations behind", async () => {
    const user = await registerUser();
    const friend = await registerUser("Friend");
    const playlistId = await createPlaylist(user.token);

    await awardPoints(user.userId, "SESSION_MEASURED", null, { entityKey: "s1" });
    await PlaylistInvitation.create({
      playlistId,
      invitedUserId: friend.userId,
      invitedByUserId: user.userId,
    });

    expect(await PointAward.countDocuments({ userId: user.userId })).toBeGreaterThan(0);
    expect(await RefreshToken.countDocuments({ userId: user.userId })).toBeGreaterThan(0);

    await deleteAccount(user.userId);

    // "Removes your account and all history" left all three behind.
    expect(await PointAward.countDocuments({ userId: user.userId })).toBe(0);
    expect(await RefreshToken.countDocuments({ userId: user.userId })).toBe(0);
    expect(await PlaylistInvitation.countDocuments({ invitedByUserId: user.userId })).toBe(0);
    expect(await User.findById(user.userId)).toBeNull();
  });
});

describe("invitations do not outlive what they invite you to", () => {
  it("removes pending invitations when the playlist is deleted", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    expect(await PlaylistInvitation.countDocuments({ status: "pending" })).toBe(1);

    await request(app)
      .delete(`/api/playlists/delete/${playlistId}`)
      .set(authed(owner.token));

    // The invitation used to survive, naming a playlist that no longer existed;
    // accepting it reported success and joined nothing.
    expect(await PlaylistInvitation.countDocuments({ status: "pending" })).toBe(0);

    const inbox = await request(app)
      .get("/api/playlists/invitations")
      .set(authed(invitee.token));
    expect(inbox.body.invitations).toHaveLength(0);
  });

  it("removes someone who declines after joining through the link", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    // They join by link before answering the invitation.
    const code = (await Playlist.findById(playlistId)).inviteLink.code;
    await request(app)
      .get(`/api/playlists/invite/accept/${code}`)
      .set(authed(invitee.token));
    expect((await Playlist.findById(playlistId)).collaborators).toHaveLength(1);

    const invitation = await PlaylistInvitation.findOne({ status: "pending" });
    await request(app)
      .post(`/api/playlists/invitations/${invitation._id}/respond`)
      .set(authed(invitee.token))
      .send({ accept: false });

    // A "Decline" that leaves you a collaborator is not a decline.
    expect((await Playlist.findById(playlistId)).collaborators).toHaveLength(0);
  });
});

describe("the server does not claim more than it did", () => {
  it("says when there was no feedback to remove", async () => {
    const user = await registerUser();
    const musicId = "507f1f77bcf86cd799439011";

    const response = await request(app)
      .delete(`/api/wellbeing/feedback/${musicId}`)
      .set(authed(user.token));

    // "Feedback removed" was reported whether or not anything matched.
    expect(response.body.removed).toBe(false);
    expect(response.body.message).toMatch(/no feedback/i);
    expect(await ListeningFeedback.countDocuments({})).toBe(0);
  });
});

