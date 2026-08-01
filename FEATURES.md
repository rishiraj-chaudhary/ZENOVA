# ZENOVA — Feature & Implementation Reference

A music-wellbeing app that does something most recommenders don't: it asks how you felt
before, asks again after, and ranks songs by the difference.

| | |
|---|---|
| **48** | HTTP endpoints |
| **16** | MongoDB collections |
| **29** | Backend services |
| **9** | React pages |
| **282** | Automated tests |
| **~18.6k** | Lines of code |

---

## The core idea

```
  mood before          listening session          mood after         Δ
      2      ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    4     ───────► +2  ──►  song-effect ledger
```

Everything else in the system records what was *recommended*. This records what **changed** —
and it is the only part that can't be copied from another music app, because it needs the user
to answer twice. Every completed session writes a `(song, starting mood) → delta` observation,
and recommendations are ranked from that ledger rather than from popularity.

---

## Accounts & sessions — 6 endpoints

### Email & password sign-in
`POST /api/auth/register` · `/login` — `services/authService.js`

Passwords are hashed with **bcrypt**. The hash is `select: false` on the schema, so no query can
leak it by accident — the auth service opts in explicitly. Unknown email and wrong password
return the same message, so the response can't be used to enumerate who has an account.

> `bcryptjs` · Mongoose · express-validator

### Two-token session with rotation
`POST /api/auth/refresh` · `/logout` · `/logout-all` — `services/refreshTokenService.js`

A short-lived **JWT access token** (15 minutes) is held in memory only — never in storage — so an
XSS window is bounded. A 30-day **refresh token** lives in an httpOnly cookie and is single-use:
presenting one atomically revokes it and issues a replacement.

Presenting an *already-revoked* token means it was stolen and replayed, so the entire token family
for that user is revoked. Rotation is a single conditional `findOneAndUpdate`, so two concurrent
refreshes can't both succeed.

> jsonwebtoken · httpOnly cookie · `SameSite=None; Secure` · SHA-256 token hashes

### Sign in with Spotify
`GET /api/music/recommend/spotify/auth` — `controllers/musicController.js`

Full **OAuth 2.0 authorization-code flow**. The callback reads the Spotify profile, finds or creates
a ZENOVA account, and issues the same session the password path does. An `intent` stored
server-side in the session — not in the query string — decides whether the callback signs you in
or attaches Spotify to the account you're already in.

Accounts match on the **Spotify user id**, never on email alone. ZENOVA doesn't verify addresses at
registration, so auto-linking by email would let someone register with your address and wait for
you to sign in with Spotify.

> OAuth 2.0 · CSRF state (fail-closed) · spotify-web-api-node

---

## Conversational AI — Gemini 3.5 Flash

### Therapeutic chat & mood detection
`POST /api/gemini/chat` · `/analyze-mood` — `services/geminiService.js`

Google's **Generative AI SDK** with `responseSchema` structured output, so the model returns typed
JSON rather than prose that has to be scraped. The prompt carries the user's name, stated
preferences, recent mood trend and session count.

Calls run through a **failover chain**: retry with exponential backoff on 429/5xx, move to the next
model on anything non-retryable, and cool a failed model down for 60 seconds so the next request
skips it.

> @google/generative-ai · structured output · model failover · token metrics

### Prompt-injection boundary
`utils/untrustedContent.js`

Anything the user controls — the message *and* the conversation history the browser posts back
each turn — is wrapped in a **per-process random delimiter**, with delimiter-lookalikes stripped
from the content and an explicit instruction that the enclosed region is data, never instructions.

Three layers because none alone is sufficient. It matters most for the crisis classifier, whose
entire prompt *is* the user's message.

> crypto.randomBytes · content sanitisation

---

## Crisis safety — 53 patterns, gated eval

### Layered risk detection ⚠️ safety-critical
`GET /api/wellbeing/support` *(public)* — `services/safetyService.js`

Two detectors with different jobs. A **deterministic regex layer** gives precision and can't be
talked out of a decision — it covers euphemisms like `kys`, `unalive` and `kms`, with a lookbehind
so "I ran 5 kms" doesn't trip it. An **LLM classifier** then catches the phrasings no pattern
anticipated.

At crisis level the music path is never reached: the response is helplines and an emergency notice,
with **region-aware** numbers resolved from the request. Support contacts are the one public
endpoint — you shouldn't need an account to reach them. If the classifier fails, the response is
marked `degraded` rather than silently returning "no risk".

> regex + LLM ensemble · region routing · degraded-state observability

### Eval harness with recall gating
`evals/runSafetyEval.js`

A labelled dataset run against the live classifier, gated on **crisis recall** — a missed crisis
fails the run outright, where a false positive only costs precision. It also fails if more than 15%
of classifications came back degraded, because a rate-limited classifier that silently returns
"none" would otherwise score 100%.

> Node runner · concurrency + pacing · failure-rate gate

---

## Music recommendation — 5 endpoints

### Mood-to-music pipeline
`POST /api/music/recommend/recommendations` — `services/recommendationService.js`

Risk is assessed first, then Gemini proposes candidates with a therapeutic goal and a per-song
reason. Each is resolved against the **Spotify catalogue** through progressively looser queries
(exact `track:`/`artist:` first) and persisted as a reusable `MusicResource`.

A natural-language parser reads how many songs you asked for — "give me 3 calming songs" — through
intervening adjectives, with word-boundary matching so "Germany" isn't read as "many". If
generation fails, a curated set is served and the response says so, so the client never passes
stand-ins off as personalised picks.

> Gemini · Spotify Search API · client-credentials token cache

### Playback with real fallbacks
`services/previewService.js` · `components/YouTubeFallback.jsx`

Spotify Premium is required for full playback and roughly a third of the catalogue has no Spotify
match at all, so there are three tiers: the **Web Playback SDK** for Premium, a **30-second
preview** played inline, and a YouTube link.

Spotify stopped publishing preview URLs, so previews are resolved from the **iTunes Search API** —
free and unauthenticated. Both title and artist must match, because a title-only match returns a
preview of a different song, which is worse than none.

> Spotify Web Playback SDK · iTunes Search API · in-process LRU cache

---

## Measured outcomes — the differentiator

### Before / after session loop
`POST /api/wellbeing/sessions/start` · `/listened` · `/complete` — `services/outcomeService.js`

Rate your mood 1–5 before listening, and again afterwards. The pair is stored as a `SessionOutcome`
with a computed delta. Listening and measuring are recorded separately — you can finish a session
without answering the follow-up, and that still counts as real use, just not as evidence.

Both writes are gated on explicit mood-tracking consent, enforced at the write rather than in the UI.

> Mongoose virtuals · conditional updates · consent gate

### Effect ledger & shrinkage ranking ★ novel
`services/songEffectService.js` · `models/SongEffect.js`

Each completed session updates running **sufficient statistics** per `(song, starting mood)` cell —
observation count, sum of deltas, sum of squares — via atomic `$inc`, so concurrent sessions can't
lose an update.

Ranking uses a **shrinkage estimator** with a Bayesian zero-effect prior: `sumDelta / (n + prior)`.
This is the whole point — five identical +3 ratings have zero variance, so a naive confidence bound
collapses to nothing and thin evidence outranks strong. Shrinkage pulls small samples toward "no
effect" until they earn their place. Below 20 observations a song is labelled provisional rather
than asserted.

> atomic `$inc` · Bayesian shrinkage · Welford-style statistics

---

## Mood tracking & insights — 9 endpoints

### Daily check-in, consent-gated
`POST` · `GET /api/wellbeing/moods` — `services/moodService.js` · `services/consentService.js`

Mood is special-category health data under **GDPR Art. 9** and India's **DPDP Act**, so consent
defaults to off and is checked inside every write path — self-reported ratings and AI-inferred
moods alike. A check-in without consent is refused with a clear message rather than reported as
saved.

> GDPR Art. 9 · DPDP · write-level enforcement

### Personal insights dashboard
`GET /api/wellbeing/insights` — `services/moodInsightsService.js` · `components/MoodChart.jsx`

Aggregates a rolling window into a daily valence series, the most frequent moods, the hardest day of
the week, the roughest time of day, and a direction. The trend compares the first and second half of
the window — a simple split is more honest than a regression line over sparse, irregular
self-reports.

When there are too few entries to compare halves it returns `unknown`, and the UI says so rather
than asserting "holding steady". The chart is hand-drawn **SVG** — no chart library — so bundle size
stays small and the axes mean what the data means.

> MongoDB aggregation · hand-rolled SVG · local-day bucketing

### Song feedback & taste profile
`POST` · `DELETE /api/wellbeing/feedback` — `services/tasteService.js`

Like / dislike / save signals per song, aggregated into preferred genres that feed back into the
recommendation prompt. Feedback carries the mood you were in at the time, so a preference is
contextual rather than absolute.

> aggregation pipeline · prompt feedback loop

---

## Playlists & collaboration — 15 endpoints

### Playlists, ordering and voice creation
`POST /api/playlists/create` · `/addsong` · `PUT /:playlistId/order` — `services/playlistService.js`

Standard CRUD plus drag-free reordering. The client's ordering is treated as a *preference, not the
whole truth*: anything it doesn't mention keeps its relative order and follows, so a stale list
can't delete a song a collaborator just added.

Voice creation parses a spoken command — "make me a playlist for studying" — into a name and a type,
then fills it from the recommendation engine.

> Web Speech API · command parsing · merge-not-replace ordering

### Invitations you can decline
`POST /invite/username` · `/invite/qr` · `/invitations/:id/respond` — `models/PlaylistInvitation.js`

Three ways in: by username, by expiring link, or by QR code. Inviting someone by name creates a
**pending invitation** they accept or decline — a mood-derived playlist is personal enough that
joining should be a choice, not something done to you.

A partial unique index allows re-inviting after a decline but blocks duplicate pending invites, and
the accept is a conditional update so a double-click can't join twice. Removing a collaborator
rotates the invite code, so the link they hold stops working.

> partial unique index · qrcode · 7-day link TTL

### Realtime collaboration
`services/socketManager.js` · `services/socketAuth.js` · `context/SocketContext.jsx`

**Socket.IO** with authentication in the handshake middleware: identity comes from the verified JWT
on `socket.data`, never from the event payload. Joining a playlist room requires a membership check
— being signed in doesn't entitle you to someone else's traffic.

Presence is keyed by socket id, so two tabs show you once and closing one doesn't remove you. The
server is the single source of realtime events; the client only says which room it wants.
Handshakes mint a fresh token, and a rejected reconnect refreshes and retries — Socket.IO won't
retry a middleware rejection on its own.

> Socket.IO · `io.use()` auth · room authorization · presence roster

---

## Progress & motivation — 3 endpoints

### Points, aimed at measurement
`GET /api/gamification/stats` — `services/pointsService.js` · `models/PointAward.js`

The reward table is pointed at **measured sessions** (30) and check-ins (15) rather than volume —
paying per song added would pay users to generate events carrying no before/after reading, which
injects motivated noise into the ledger recommendations are ranked from. You can't pay for an
answer and then trust it.

Every award is recorded against the entity that earned it, with a unique index as the anti-farming
mechanism: deleting and recreating a playlist, or logging out and back in, pays once. Daily ceilings
are enforced **claim-then-verify** — insert first, count after, withdraw if over — because checking
before writing is a race that twenty concurrent requests all win.

> unique-index dedup · atomic `$inc`/`$max` · TOCTOU-safe caps

### Streaks, levels and badges
`utils/dayKey.js` · `services/badgeService.js`

Streaks count **calendar days** via memoised `Intl.DateTimeFormat`, not elapsed milliseconds — an
11pm visit followed by an 8am one is two days, and raw arithmetic scored it as zero. A grace period
forgives one short gap every two weeks, and a broken streak is worded as a restart rather than
announced as an achievement.

Levels derive from a single threshold table shared by the server and the progress bar. Badges are
seeded from config on every boot, so an edit actually lands, and any badge dropped from config is
deactivated rather than left permanently unearnable.

> Intl.DateTimeFormat · bulkWrite upserts · monotonic `$max` levels

### Leaderboards & award delivery
`GET /api/leaderboard?type=` — `services/leaderboardService.js` · `services/awardInbox.js`

All-time, weekly and monthly boards aggregate the award ledger over **ISO week** and calendar-month
keys, so the three tabs genuinely differ. Rebuilds are debounced behind a Mongo-backed `TaskLock` so
concurrent awards don't stampede, and a stale board schedules its own refresh on read.

Award notifications track delivery: emitting into an empty room isn't a notification, so points
earned before the socket connects — the login bonus, chiefly — are replayed as a single summary on
the next connection.

> aggregation pipeline · distributed lock · delivery receipts

---

## Privacy & data rights — 3 endpoints

### Export and erasure
`GET /api/privacy/export` · `DELETE /wellbeing-data` · `/account` — `services/privacyService.js`

A single JSON document with everything held about you: mood history, song feedback, session
outcomes, playlists, progress and badges. Erasure comes in two strengths — wellbeing data only,
which also resets the counters derived from it, or the whole account.

Account deletion runs in a **transaction** and sweeps every collection keyed to the user, including
the award ledger, live refresh tokens, invitations and cached leaderboard rows. Playlists you own
are removed; playlists you merely collaborated on survive with your membership stripped, so leaving
can't destroy someone else's data.

> Mongo transactions · GDPR Art. 15 / 17 · cross-collection sweep

---

## Platform & hardening

### Request hardening
`config/security.js` · `middlewares/`

**Helmet** for security headers and CSP, **CORS** with an explicit origin allowlist, per-route
**rate limiting** (tighter on auth and AI endpoints), **mongo-sanitize** against operator injection,
and **express-validator** schemas on every mutating route. Errors funnel through one handler so
stack traces never reach a client.

> helmet · express-rate-limit · express-mongo-sanitize · compression

### Testing, evals and migrations
`tests/` · `evals/` · `scripts/` · `.github/workflows/`

237 backend tests on **Vitest + Supertest** against **mongodb-memory-server**, and 45 frontend tests
on Testing Library + jsdom, run in GitHub Actions. Concurrency tests fire twenty simultaneous
requests to prove updates aren't lost; regression tests are checked against the pre-fix code to
prove they actually fail.

Idempotent migration and backfill scripts run dry by default and apply only with `--commit`. Indexes
are built explicitly at startup rather than lazily, because several writes depend on unique
constraints for correctness.

> Vitest · Supertest · mongodb-memory-server · GitHub Actions

### Frontend architecture
`frontend/src/` · `vite.config.js`

**React 19** on **Vite** with **Tailwind**, routed by react-router-dom with route-level code
splitting. Four contexts own cross-cutting state — auth, socket, gamification, Spotify — and data
fetching lives in hooks (`usePlaylists`, `useChatMessages`, `useSocketEvents`) rather than in
components.

A single axios client attaches the access token, transparently refreshes once on a 401 and retries —
but never for credential endpoints, so a mistyped password can't end the session you already had.
Error boundaries wrap each independently-failing region.

> React 19 · Vite · Tailwind · axios interceptors · error boundaries

---

## Stack at a glance

One npm workspace, two apps. The backend deploys to Render, the frontend to Vercel — which is why
sessions are cross-origin and cookies carry `SameSite=None; Secure`.

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, react-router-dom, axios, socket.io-client |
| Backend | Node.js, Express 4, Socket.IO, Mongoose |
| Database | MongoDB — 16 collections, explicit index creation, transactions for erasure |
| AI | Google Gemini 3.5 Flash via @google/generative-ai, structured output, model failover |
| Music | Spotify Web API + Web Playback SDK, iTunes Search API for previews |
| Auth | JWT access tokens, rotating refresh tokens, bcrypt, express-session + connect-mongo |
| Realtime | Socket.IO with handshake auth and per-room authorization |
| Testing | Vitest, Supertest, mongodb-memory-server, Testing Library, jsdom, GitHub Actions |
| Security | helmet, CORS allowlist, express-rate-limit, express-mongo-sanitize, express-validator |
