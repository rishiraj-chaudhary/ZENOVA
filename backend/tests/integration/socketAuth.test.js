import http from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import config from "../../config/environment.js";
import Playlist from "../../models/Playlist.js";
import User from "../../models/user.js";
import { authenticateSocket } from "../../services/socketAuth.js";
import SocketManager from "../../services/socketManager.js";
import { clearTestDb, connectTestDb, disconnectTestDb } from "../helpers/db.js";

let server;
let manager;
let url;

const tokenFor = (userId) => jwt.sign({ id: userId }, config.jwt.secret);

/** Resolves on connect, or rejects with the handshake error. */
const openSocket = (auth) =>
  new Promise((resolve, reject) => {
    const socket = connect(url, { auth, transports: ["websocket"], reconnection: false });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (error) => {
      socket.close();
      reject(error);
    });
  });

const waitFor = (socket, event, timeoutMs = 1500) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const makeUser = async (name) =>
  User.create({ name, email: `${name}-${Date.now()}@example.com`, password: "x" });

beforeAll(async () => {
  await connectTestDb();

  server = http.createServer();
  const io = new Server(server, { cors: { origin: true } });
  io.use(authenticateSocket);
  manager = new SocketManager(io);

  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(clearTestDb);

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await disconnectTestDb();
});

describe("handshake authentication", () => {
  it("rejects a socket with no token", async () => {
    await expect(openSocket({})).rejects.toThrow(/Authentication required/);
  });

  it("rejects a forged token", async () => {
    const forged = jwt.sign({ id: "000000000000000000000000" }, "not-the-secret");
    await expect(openSocket({ token: forged })).rejects.toThrow(/Authentication required/);
  });

  it("rejects a valid token for a deleted account", async () => {
    const user = await makeUser("ghost");
    const token = tokenFor(user._id);
    await User.deleteOne({ _id: user._id });

    await expect(openSocket({ token })).rejects.toThrow(/Authentication required/);
  });

  it("accepts a valid token", async () => {
    const user = await makeUser("valid");
    const socket = await openSocket({ token: tokenFor(user._id) });

    expect(socket.connected).toBe(true);
    socket.close();
  });
});

describe("private user rooms", () => {
  it("delivers a user's events only to that user", async () => {
    const [alice, mallory] = [await makeUser("alice"), await makeUser("mallory")];

    const aliceSocket = await openSocket({ token: tokenFor(alice._id) });
    const mallorySocket = await openSocket({ token: tokenFor(mallory._id) });

    let malloryHeard = false;
    mallorySocket.on("points_awarded", () => {
      malloryHeard = true;
    });

    const heard = waitFor(aliceSocket, "points_awarded");
    manager.emitToUser(alice._id.toString(), "points_awarded", { points: 5 });

    // register_user used to join `user:<any id>`, so a socket could subscribe
    // to another person's private notifications by guessing an ObjectId.
    expect(await heard).toEqual({ points: 5 });
    expect(malloryHeard).toBe(false);

    aliceSocket.close();
    mallorySocket.close();
  });
});

describe("playlist room authorization", () => {
  it("lets a member join", async () => {
    const owner = await makeUser("owner");
    const playlist = await Playlist.create({ userId: owner._id, name: "Mine", songs: [] });

    const socket = await openSocket({ token: tokenFor(owner._id) });
    const joined = waitFor(socket, "user_joined");
    socket.emit("join_playlist", { playlistId: playlist._id.toString() });

    const payload = await joined;
    expect(payload.users).toHaveLength(1);
    socket.close();
  });

  it("denies a non-member and delivers them nothing", async () => {
    const owner = await makeUser("owner2");
    const outsider = await makeUser("outsider");
    const playlist = await Playlist.create({ userId: owner._id, name: "Private", songs: [] });

    const socket = await openSocket({ token: tokenFor(outsider._id) });
    const denied = waitFor(socket, "join_denied");
    socket.emit("join_playlist", { playlistId: playlist._id.toString() });

    // Joining used to require nothing at all, so any socket could subscribe to
    // any playlist's traffic.
    expect((await denied).playlistId).toBe(playlist._id.toString());
    socket.close();
  });

  it("denies a malformed playlist id without throwing", async () => {
    const user = await makeUser("prober");
    const socket = await openSocket({ token: tokenFor(user._id) });

    const denied = waitFor(socket, "join_denied");
    socket.emit("join_playlist", { playlistId: "not-an-id" });

    expect((await denied).playlistId).toBe("not-an-id");
    socket.close();
  });
});

describe("presence across tabs", () => {
  it("counts a user once with two tabs open", async () => {
    const owner = await makeUser("twotab");
    const playlist = await Playlist.create({ userId: owner._id, name: "P", songs: [] });
    const id = playlist._id.toString();

    const first = await openSocket({ token: tokenFor(owner._id) });
    first.emit("join_playlist", { playlistId: id });
    await waitFor(first, "user_joined");

    const second = await openSocket({ token: tokenFor(owner._id) });
    const rejoined = waitFor(first, "user_joined");
    second.emit("join_playlist", { playlistId: id });

    // Roster is keyed by socket then collapsed by user, so two tabs are one
    // person rather than two entries.
    expect((await rejoined).users).toHaveLength(1);

    first.close();
    second.close();
  });

  it("keeps a user present until their last tab closes", async () => {
    const owner = await makeUser("lasttab");
    const playlist = await Playlist.create({ userId: owner._id, name: "P", songs: [] });
    const id = playlist._id.toString();

    const first = await openSocket({ token: tokenFor(owner._id) });
    first.emit("join_playlist", { playlistId: id });
    await waitFor(first, "user_joined");

    const second = await openSocket({ token: tokenFor(owner._id) });
    second.emit("join_playlist", { playlistId: id });
    await waitFor(first, "user_joined");

    let departed = false;
    first.on("user_left", () => {
      departed = true;
    });

    second.emit("leave_playlist", { playlistId: id });
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Closing one tab used to remove the user's presence entirely, because the
    // roster was keyed by user id.
    expect(departed).toBe(false);

    first.close();
    second.close();
  });
});
