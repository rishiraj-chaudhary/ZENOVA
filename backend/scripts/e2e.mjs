/**
 * End-to-end walk through a running server: register, consent, check in, get a
 * recommendation, listen, measure, collaborate, export, log out.
 *
 * Talks HTTP and Socket.IO exactly as the browser does — no mocks, no test
 * doubles, real Gemini calls. Unit and integration tests prove each piece in
 * isolation; this proves the pieces are actually connected to each other.
 *
 *   npm run dev      # in another terminal
 *   npm run e2e
 */
import { io as connect } from "socket.io-client";

const ORIGIN = process.env.E2E_ORIGIN ?? "http://localhost:3000";
const BASE = `${ORIGIN}/api`;
const stamp = Date.now();

let passed = 0;
let failed = 0;

const check = (label, ok, detail = "") => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label} ${detail}`);
  }
};

const call = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body: json };
};

const register = async (name) => {
  const { status, body } = await call("POST", "/auth/register", {
    body: {
      name: `${name}-${stamp}`,
      email: `${name}-${stamp}@example.com`,
      password: "hunter2secure",
    },
  });
  if (status !== 201 && status !== 200) {
    throw new Error(`register ${name} failed: ${status} ${JSON.stringify(body)}`);
  }
  return { token: body.user.token, userId: body.user._id, name: body.user.name };
};

const openSocket = (token) =>
  new Promise((resolve, reject) => {
    const socket = connect(ORIGIN, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("socket timeout")), 5000);
  });

const settle = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  console.log("\n1. Accounts and authentication");
  const alice = await register("alice");
  const bob = await register("bob");
  check("register returns a usable token", Boolean(alice.token && bob.token));

  const anon = await call("GET", "/playlists/my-playlists");
  check("unauthenticated request is refused", anon.status === 401, `got ${anon.status}`);

  const login = await call("POST", "/auth/login", {
    body: { email: `alice-${stamp}@example.com`, password: "hunter2secure" },
  });
  check("login succeeds", login.status === 200, `got ${login.status}`);
  check("login issues a refresh token", Boolean(login.body?.refreshToken));

  const badLogin = await call("POST", "/auth/login", {
    body: { email: `alice-${stamp}@example.com`, password: "wrongpassword" },
  });
  check("wrong password is refused", badLogin.status === 401, `got ${badLogin.status}`);

  console.log("\n2. Missed-award replay");
  // The login bonus is granted during POST /auth/login, before any socket
  // exists, so it can only reach the user on their next connection.
  const missed = new Promise((resolve) => {
    openSocket(login.body.user.token).then((socket) => {
      socket.on("awards_missed", (payload) => resolve({ payload, socket }));
      setTimeout(() => resolve({ payload: null, socket }), 3000);
    });
  });
  const { payload: replay, socket: aliceSocket } = await missed;
  check("awards granted before connect are replayed", Boolean(replay?.points), JSON.stringify(replay));

  console.log("\n3. Consent gating and mood check-in");
  const beforeConsent = await call("POST", "/wellbeing/moods", {
    token: alice.token,
    body: { mood: "low", intensity: 2 },
  });
  const storedWithoutConsent = await call("GET", "/wellbeing/moods", { token: alice.token });
  check(
    "no mood is stored without consent",
    (storedWithoutConsent.body?.entries ?? []).length === 0,
    `status ${beforeConsent.status}`
  );

  await call("PUT", "/users/consent", { token: alice.token, body: { moodTracking: true } });
  const checkIn = await call("POST", "/wellbeing/moods", {
    token: alice.token,
    body: { mood: "low", intensity: 2 },
  });
  check("check-in is stored once consent is given", checkIn.status === 201, `got ${checkIn.status}`);

  console.log("\n4. Recommendation, listening and measurement");
  const recommend = await call("POST", "/music/recommend/recommendations", {
    token: alice.token,
    body: { message: "I have been feeling low and tired all week" },
  });
  check("recommendation returns songs", (recommend.body?.recommendations ?? []).length > 0,
    `status ${recommend.status} ${JSON.stringify(recommend.body).slice(0, 200)}`);
  const sessionId = recommend.body?.sessionId;
  check("recommendation opens a measurable session", Boolean(sessionId));

  if (sessionId) {
    const start = await call("POST", "/wellbeing/sessions/start", {
      token: alice.token,
      body: { sessionId, moodBefore: 2 },
    });
    check("before-rating is accepted", start.status < 300, `got ${start.status}`);

    const listened = await call("POST", "/wellbeing/sessions/listened", {
      token: alice.token,
      body: { sessionId },
    });
    check("listening is recorded", listened.body?.recorded === true, JSON.stringify(listened.body));

    const listenedAgain = await call("POST", "/wellbeing/sessions/listened", {
      token: alice.token,
      body: { sessionId },
    });
    check("listening pays only once", listenedAgain.body?.recorded === false);

    const complete = await call("POST", "/wellbeing/sessions/complete", {
      token: alice.token,
      body: { sessionId, moodAfter: 4 },
    });
    check("after-rating is accepted", complete.status === 200, `got ${complete.status}`);
    check("the delta is computed", complete.body?.delta === 2, `delta ${complete.body?.delta}`);
  }

  const stats = await call("GET", "/gamification/stats", { token: alice.token });
  check("stats report measured sessions", stats.body?.measuredSessions >= 1, JSON.stringify(stats.body?.measuredSessions));
  check("stats include level progress", Boolean(stats.body?.progress?.levelName), JSON.stringify(stats.body?.progress));

  const insights = await call("GET", "/wellbeing/insights", { token: alice.token });
  check("insights respond", insights.status === 200, `got ${insights.status}`);

  console.log("\n5. Crisis path");
  const crisis = await call("POST", "/music/recommend/recommendations", {
    token: alice.token,
    body: { message: "I want to kill myself tonight" },
  });
  check("crisis message does not 500", crisis.status < 500, `got ${crisis.status}`);
  check("crisis is classified as such", crisis.body?.riskLevel === "crisis",
    `riskLevel ${crisis.body?.riskLevel}`);
  check("crisis response carries helplines",
    (crisis.body?.supportResources ?? []).length > 0,
    JSON.stringify(crisis.body?.supportResources));
  check("crisis response carries an emergency notice", Boolean(crisis.body?.emergencyNotice));
  // Answering a suicidal message with a playlist would be the wrong response.
  check("no music is recommended at a crisis moment",
    (crisis.body?.recommendations ?? []).length === 0);

  console.log("\n6. Playlists, invitations and ordering");
  const created = await call("POST", "/playlists/create", {
    token: alice.token,
    body: { name: "Evening wind-down" },
  });
  const playlistId = created.body?.playlist?._id ?? created.body?._id;
  check("playlist is created", Boolean(playlistId), `status ${created.status}`);

  const songs = (recommend.body?.recommendations ?? []).slice(0, 3);
  for (const song of songs) {
    await call("POST", "/playlists/addsong", {
      token: alice.token,
      body: { playlistId, songId: song._id ?? song.musicId },
    });
  }
  const withSongs = await call("GET", "/playlists/my-playlists", { token: alice.token });
  const mine = withSongs.body?.find?.((p) => p._id === playlistId)
    ?? withSongs.body?.playlists?.find?.((p) => p._id === playlistId);
  check("songs are in the playlist",
    songs.length > 0 && (mine?.songs ?? []).length === songs.length,
    `${(mine?.songs ?? []).length} of ${songs.length}`);

  if ((mine?.songs ?? []).length >= 2) {
    const ids = mine.songs.map((s) => s.musicId);
    const reversed = [...ids].reverse();
    const reorder = await call("PUT", `/playlists/${playlistId}/order`, {
      token: alice.token,
      body: { musicIds: reversed },
    });
    check("reorder is accepted", reorder.status === 200, `got ${reorder.status}`);

    const reloaded = await call("GET", "/playlists/my-playlists", { token: alice.token });
    const after = (reloaded.body?.find?.((p) => p._id === playlistId)
      ?? reloaded.body?.playlists?.find?.((p) => p._id === playlistId));
    check("the new order survives a reload",
      JSON.stringify(after.songs.map((s) => s.musicId)) === JSON.stringify(reversed),
      JSON.stringify(after.songs.map((s) => s.title)));
  }

  const bobSocket = await openSocket(bob.token);
  const invited = new Promise((resolve) => {
    bobSocket.on("invitation_received", resolve);
    setTimeout(() => resolve(null), 3000);
  });

  const invite = await call("POST", "/playlists/invite/username", {
    token: alice.token,
    body: { playlistId, username: bob.name },
  });
  check("invitation is sent", invite.status === 200, `got ${invite.status} ${JSON.stringify(invite.body)}`);

  const notification = await invited;
  check("the recipient is notified in realtime", Boolean(notification?.playlistId), JSON.stringify(notification));

  const bobLists = await call("GET", "/playlists/my-playlists", { token: bob.token });
  const bobHasIt = (bobLists.body?.length ?? bobLists.body?.playlists?.length ?? 0) > 0;
  check("the invitee is not added before accepting", !bobHasIt);

  const inbox = await call("GET", "/playlists/invitations", { token: bob.token });
  check("the invitation appears in the recipient's inbox",
    (inbox.body?.invitations ?? []).length === 1, JSON.stringify(inbox.body));

  const invitationId = inbox.body?.invitations?.[0]?._id;
  const accepted = await call("POST", `/playlists/invitations/${invitationId}/respond`, {
    token: bob.token,
    body: { accept: true },
  });
  check("accepting succeeds", accepted.status === 200, `got ${accepted.status}`);

  const bobAfter = await call("GET", "/playlists/my-playlists", { token: bob.token });
  const bobPlaylists = bobAfter.body?.length ? bobAfter.body : bobAfter.body?.playlists ?? [];
  check("the playlist appears only after accepting", bobPlaylists.length === 1,
    `${bobPlaylists.length} playlists`);
  check("the invitee is marked a collaborator", bobPlaylists[0]?.isCollaborator === true);

  console.log("\n7. Realtime collaboration");
  aliceSocket.emit("join_playlist", { playlistId });
  bobSocket.emit("join_playlist", { playlistId });
  await settle(600);

  const songAdded = new Promise((resolve) => {
    aliceSocket.on("song_added", resolve);
    setTimeout(() => resolve(null), 3000);
  });

  const extra = (recommend.body?.recommendations ?? [])[3];
  if (extra) {
    await call("POST", "/playlists/addsong", {
      token: bob.token,
      body: { playlistId, songId: extra._id ?? extra.musicId },
    });
    const event = await songAdded;
    check("a collaborator's change reaches the owner live", Boolean(event?.song),
      JSON.stringify(event));
  } else {
    check("a collaborator's change reaches the owner live", false, "no fourth song to add");
  }

  // A socket that is not a member must be refused the room.
  const stranger = await register("stranger");
  const strangerSocket = await openSocket(stranger.token);
  const denied = new Promise((resolve) => {
    strangerSocket.on("join_denied", resolve);
    setTimeout(() => resolve(null), 2000);
  });
  strangerSocket.emit("join_playlist", { playlistId });
  check("a non-member is denied the playlist room", Boolean(await denied));

  console.log("\n8. Privacy: export and erase");
  const exported = await call("GET", "/privacy/export", { token: alice.token });
  check("data export returns the user's records", exported.status === 200, `got ${exported.status}`);
  check("the export contains mood history",
    Array.isArray(exported.body?.moodHistory),
    Object.keys(exported.body ?? {}).join(","));

  console.log("\n9. Logout and token revocation");
  const loggedOut = await call("POST", "/auth/logout", {
    token: login.body.user.token,
    body: { refreshToken: login.body.refreshToken },
  });
  check("logout succeeds", loggedOut.status === 200, `got ${loggedOut.status}`);

  const reuse = await call("POST", "/auth/refresh", {
    body: { refreshToken: login.body.refreshToken },
  });
  check("a revoked refresh token is refused", reuse.status === 401, `got ${reuse.status}`);

  [aliceSocket, bobSocket, strangerSocket].forEach((s) => s.close());

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
};

run().catch((error) => {
  console.error("\nE2E aborted:", error.message);
  process.exit(1);
});
