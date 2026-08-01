import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import MusicResource from "../../models/MusicResource.js";
import Playlist from "../../models/Playlist.js";
import PlaylistInvitation from "../../models/PlaylistInvitation.js";
import { buildTestApp } from "../helpers/app.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

const app = buildTestApp();

let counter = 0;
const registerUser = async (name) => {
  counter += 1;
  const { body } = await request(app).post("/api/auth/register").send({
    name,
    email: `invite-${counter}-${Date.now()}@example.com`,
    password: "hunter2secure",
  });
  return { token: body.user.token, userId: body.user._id, name };
};

const authed = (token) => ({ Authorization: `Bearer ${token}` });

const createPlaylist = async (token, name = "Evening wind-down") => {
  const body = await request(app)
    .post("/api/playlists/create")
    .set(authed(token))
    .send({ name });
  return body.body.playlist?._id ?? body.body._id;
};

beforeAll(connectTestDb);
afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe("playlist invitations", () => {
  it("does not add the invitee until they accept", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    const response = await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    expect(response.status).toBe(200);

    // Inviting used to push the user straight into collaborators.
    const playlist = await Playlist.findById(playlistId);
    expect(playlist.collaborators).toHaveLength(0);
    expect(await PlaylistInvitation.countDocuments({ status: "pending" })).toBe(1);
  });

  it("shows the invitation to the recipient and adds them on accept", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    const inbox = await request(app)
      .get("/api/playlists/invitations")
      .set(authed(invitee.token));

    expect(inbox.body.invitations).toHaveLength(1);
    const [invitation] = inbox.body.invitations;
    expect(invitation.playlistId.name).toBe("Evening wind-down");
    expect(invitation.invitedByUserId.name).toBe("Owner");

    const accepted = await request(app)
      .post(`/api/playlists/invitations/${invitation._id}/respond`)
      .set(authed(invitee.token))
      .send({ accept: true });

    expect(accepted.status).toBe(200);
    const playlist = await Playlist.findById(playlistId);
    expect(playlist.collaborators.map(String)).toEqual([invitee.userId]);
  });

  it("adds nobody when the invitation is declined", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    const { body } = await request(app)
      .get("/api/playlists/invitations")
      .set(authed(invitee.token));

    await request(app)
      .post(`/api/playlists/invitations/${body.invitations[0]._id}/respond`)
      .set(authed(invitee.token))
      .send({ accept: false });

    const playlist = await Playlist.findById(playlistId);
    expect(playlist.collaborators).toHaveLength(0);
    expect(await PlaylistInvitation.countDocuments({ status: "declined" })).toBe(1);
  });

  it("refuses a second pending invitation for the same person", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    const invite = () =>
      request(app)
        .post("/api/playlists/invite/username")
        .set(authed(owner.token))
        .send({ playlistId, username: invitee.name });

    await invite();
    expect((await invite()).status).toBe(409);
  });

  it("lets nobody else answer an invitation addressed to someone", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const stranger = await registerUser("Stranger");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    const invitation = await PlaylistInvitation.findOne({});

    const response = await request(app)
      .post(`/api/playlists/invitations/${invitation._id}/respond`)
      .set(authed(stranger.token))
      .send({ accept: true });

    expect(response.status).toBe(404);
    expect((await Playlist.findById(playlistId)).collaborators).toHaveLength(0);
  });

  it("accepts only once when the recipient double-clicks", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });

    const invitation = await PlaylistInvitation.findOne({});
    const respond = () =>
      request(app)
        .post(`/api/playlists/invitations/${invitation._id}/respond`)
        .set(authed(invitee.token))
        .send({ accept: true });

    const [first, second] = await Promise.all([respond(), respond()]);

    // The status transition is a conditional update, so only one call wins.
    expect([first.status, second.status].sort()).toEqual([200, 404]);
    expect((await Playlist.findById(playlistId)).collaborators).toHaveLength(1);
  });
});

describe("song ordering", () => {
  const addSongs = async (token, playlistId, titles) => {
    const ids = [];
    for (const title of titles) {
      const song = await MusicResource.create({
        title,
        artist: "A",
        genre: "calm",
        duration: 180,
        audioUrl: `https://example.com/${title}.mp3`,
      });
      await request(app)
        .post("/api/playlists/addsong")
        .set(authed(token))
        .send({ playlistId, songId: song._id.toString() });
      ids.push(song._id.toString());
    }
    return ids;
  };

  const titlesOf = async (playlistId) =>
    (await Playlist.findById(playlistId)).songs.map((s) => s.title);

  it("persists the new order", async () => {
    const owner = await registerUser("Owner");
    const playlistId = await createPlaylist(owner.token);
    const [a, b, c] = await addSongs(owner.token, playlistId, ["A", "B", "C"]);

    // Reordering used to be broadcast over a socket and never written down.
    const response = await request(app)
      .put(`/api/playlists/${playlistId}/order`)
      .set(authed(owner.token))
      .send({ musicIds: [c, a, b] });

    expect(response.status).toBe(200);
    expect(await titlesOf(playlistId)).toEqual(["C", "A", "B"]);
  });

  it("keeps a song a collaborator added while the order was being changed", async () => {
    const owner = await registerUser("Owner");
    const playlistId = await createPlaylist(owner.token);
    const [a, b] = await addSongs(owner.token, playlistId, ["A", "B"]);
    await addSongs(owner.token, playlistId, ["Late arrival"]);

    // The client's list predates "Late arrival"; submitting it must not drop it.
    await request(app)
      .put(`/api/playlists/${playlistId}/order`)
      .set(authed(owner.token))
      .send({ musicIds: [b, a] });

    expect(await titlesOf(playlistId)).toEqual(["B", "A", "Late arrival"]);
  });

  it("rejects an order naming a song from another playlist", async () => {
    const owner = await registerUser("Owner");
    const playlistId = await createPlaylist(owner.token);
    const otherId = await createPlaylist(owner.token, "Other");
    await addSongs(owner.token, playlistId, ["A"]);
    const [foreign] = await addSongs(owner.token, otherId, ["Foreign"]);

    const response = await request(app)
      .put(`/api/playlists/${playlistId}/order`)
      .set(authed(owner.token))
      .send({ musicIds: [foreign] });

    expect(response.status).toBe(400);
  });

  it("refuses to reorder a playlist the caller cannot write to", async () => {
    const owner = await registerUser("Owner");
    const stranger = await registerUser("Stranger");
    const playlistId = await createPlaylist(owner.token);
    const [a, b] = await addSongs(owner.token, playlistId, ["A", "B"]);

    const response = await request(app)
      .put(`/api/playlists/${playlistId}/order`)
      .set(authed(stranger.token))
      .send({ musicIds: [b, a] });

    expect(response.status).toBe(404);
    expect(await titlesOf(playlistId)).toEqual(["A", "B"]);
  });

  it("lets an accepted collaborator reorder", async () => {
    const owner = await registerUser("Owner");
    const invitee = await registerUser("Invitee");
    const playlistId = await createPlaylist(owner.token);
    const [a, b] = await addSongs(owner.token, playlistId, ["A", "B"]);

    await request(app)
      .post("/api/playlists/invite/username")
      .set(authed(owner.token))
      .send({ playlistId, username: invitee.name });
    const invitation = await PlaylistInvitation.findOne({});
    await request(app)
      .post(`/api/playlists/invitations/${invitation._id}/respond`)
      .set(authed(invitee.token))
      .send({ accept: true });

    const response = await request(app)
      .put(`/api/playlists/${playlistId}/order`)
      .set(authed(invitee.token))
      .send({ musicIds: [b, a] });

    expect(response.status).toBe(200);
    expect(await titlesOf(playlistId)).toEqual(["B", "A"]);
  });
});
