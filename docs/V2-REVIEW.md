# ZENOVA v2 — Architectural Review of the Handoff Document

A production design review of `ZENOVA-v2-handoff.md` against the repository as it
stands. The repo is the source of truth; the handoff is treated as a draft.

**Verdict up front.** The document is unusually good. Its central insight — that
the outcome ledger measures a correlation and reports it as an effect — is
correct, is the single most valuable thing in it, and is not something most
reviewers would catch. Roughly two thirds of it should be built. The remaining
third is either already done, over-engineered for this system's data volume, or
predicated on facts about the repo that are out of date.

Four claims in it are wrong about this codebase. They are corrected in §0 because
two of them would cause real damage if acted on.

---

## 0. Corrections to the handoff

### 0.1 The model-name footnote is wrong — do not act on it

The closing note says "Gemini 3.5 Flash" does not exist and is "a cheap
credibility hit."

`backend/config/environment.js:63` configures `gemini-3.5-flash`, with a fallback
chain behind it. It is not aspirational: it served live recommendations,
mood analysis and a 44/44 safety-eval run during this session, and
`tests/unit/geminiFailover.test.js` covers the failover path around it. The
footnote is reasoning from a training cutoff, which is exactly the failure mode
it warns about.

**Action: none.** Do not rename the model. If anything, the fallback chain in
`geminiService.js` is the detail worth putting on a CV — a non-retryable error
now moves to the next candidate rather than aborting the chain, which is what
took the feature down when `gemini-2.0-flash` was retired.

### 0.2 "Spotify = an OAuth login button" is out of date

Real sign-in shipped. `services/authService.js` has `findOrCreateSpotifyUser`
and `linkSpotifyAccount`; `controllers/musicController.js` fetches the Spotify
profile in the callback and issues a session through the shared
`authSessionService.js`. Accounts match on the Spotify user id, never on email
alone, with the pre-hijacking reasoning documented and tested in
`tests/integration/spotifyLogin.test.js`.

Workstream B should be re-scoped: identity is done, **library, playback and
persona are not**. That is still most of the value, but it is not the whole
workstream the doc describes.

### 0.3 The ledger is better than "logs Δmood"

`services/songEffectService.js` already keeps running sufficient statistics per
`(musicId, startingMood)` and ranks by a shrinkage estimator with a Bayesian
zero-effect prior (`sumDelta / (n + PRIOR_STRENGTH)`), labelling anything under
20 observations provisional.

This does not weaken the doc's argument — shrinkage fixes *small-sample* bias,
not *confounding*. A shrunk estimate of a confounded quantity is still
confounded. But the framing matters for how the work is described: the control
arm upgrades an honest-about-uncertainty estimator into a causally valid one,
rather than replacing a naive average.

### 0.4 §3.3 is more feasible than the doc realises

The doc suggests computing embeddings from "the 30s iTunes preview you already
resolve." That resolution shipped: `services/previewService.js` matches against
iTunes Search, and a backfill resolved **510 previews across the 946-song
catalogue** (390 have none available). The CLAP substrate exists today.

Separately, the deprecation warning is moot here — nothing in the repo has ever
called `/audio-features`. `models/MusicResource.js:23` declares an
`audioFeatures` subdocument that no code path writes. That is dead schema and
should be dropped, not planned around.

---

## Phase 1 — What the system actually is

**Purpose.** A wellbeing app that recommends music for a stated emotional state
and then *measures whether it helped*, by asking for a mood rating before and
after a listening session.

**Target user.** Students and young adults; the docs and level names are written
for people without Spotify Premium, which is why the playback ladder degrades
through preview and YouTube.

**Core loop.** Chat → mood inferred → risk assessed → songs recommended and
resolved against Spotify → before-rating → listen → after-rating → the delta
lands in the effect ledger → future ranking reads the ledger.

**Architecture.** npm workspace, two apps. Express 4 + Mongoose + Socket.IO
behind 48 endpoints across 9 route files, 29 services, 16 collections. React 19 +
Vite + Tailwind, 9 pages, four contexts (auth, socket, gamification, Spotify),
data access in hooks. Backend on Render, frontend on Vercel — hence cross-origin
sessions and `SameSite=None; Secure`.

**Auth.** 15-minute in-memory JWT plus a rotating 30-day httpOnly refresh token
with reuse-detection family revocation, and an express-session fallback that
`authMiddleware.resolveUserId` accepts as credentials in its own right.

**AI.** One Gemini call per turn with a large assembled prompt
(`prompts/conversationPrompt.js`, `recommendationPrompt.js`), structured output
via `responseSchema`, a failover chain, and a prompt-injection boundary
(`utils/untrustedContent.js`) wrapping the message and history.

**Safety.** Deterministic regex for precision plus an LLM classifier for recall,
region-aware helplines, a `degraded` flag when the classifier fails, and
`evals/runSafetyEval.js` gating on crisis recall and a 15% degraded ceiling.

**Constraints that shape everything below.** ~75 users and ~946 songs in the
development database. Session outcomes number in the dozens, not thousands. Any
proposal whose value depends on data volume is, today, a methodology exercise —
which is fine, and should be described as such.

---

## Phase 2 — Every proposal, scored

Scores are out of 10. **Complexity is inverted** — 10 means *simple*, so a high
row total is unambiguously good.

### Workstream A — The agent

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| A1 | Tool registry + `toolAuth` + dispatch | 9 | 9 | 7 | 10 | 9 | **Keep** |
| A2 | Move conversation history server-side | 9 | 9 | 8 | 10 | 9 | **Keep** |
| A3 | `AgentRun`/`AgentStep` + OTel spans | 8 | 8 | 6 | 9 | 8 | **Modify** |
| A4 | Write tools + confirmation + `ToolAudit` | 8 | 8 | 6 | 9 | 8 | **Keep** |
| A5 | Episodic memory + Atlas Vector Search | 7 | 6 | 4 | 8 | 6 | **Modify** |
| A6 | Supervisor as parallel veto | 9 | 9 | 8 | 10 | 9 | **Keep** |
| A7 | Verifier + grounding contract | 10 | 8 | 6 | 10 | 8 | **Keep** |
| A8 | Planner + typed `Plan` | 6 | 7 | 5 | 7 | 6 | **Defer** |
| A9 | Five specialist agents | 3 | 6 | 3 | 4 | 3 | **Modify** |
| A10 | Profile memory + nightly compaction | 6 | 6 | 4 | 7 | 5 | **Merge into A5** |
| A11 | Procedural memory | 8 | 7 | 6 | 10 | 7 | **Modify** |
| A12 | Budgeted context assembler | 8 | 9 | 7 | 9 | 9 | **Keep** |
| A13 | Wrap tool output + taint tracking | 10 | 9 | 8 | 10 | 9 | **Keep** |
| A14 | Distilled ONNX classifier | 4 | 3 | 2 | 6 | 4 | **Defer** |
| A15 | MCP server | 2 | 7 | 6 | 3 | 5 | **Remove** |
| A16 | Budgets + circuit breaker | 8 | 9 | 8 | 10 | 9 | **Keep** |

### Workstream B — Spotify

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| B1 | Full scope set, requested incrementally | 8 | 9 | 8 | 9 | 8 | **Keep** |
| B2 | Real playback + device transfer | 9 | 8 | 6 | 9 | 7 | **Keep** |
| B3 | Playlist sync with reconciliation | 6 | 6 | 4 | 7 | 5 | **Defer** |
| B4 | Recently-played poller → `ListeningEvent` | 9 | 8 | 7 | 9 | 8 | **Keep** |
| B5 | Persona derivation | 8 | 8 | 6 | 9 | 7 | **Keep** |
| B6 | Persona-seeded cold start via kNN | 8 | 5 | 4 | 9 | 6 | **Modify** |
| B7 | Skip detection from playback state | 8 | 7 | 6 | 9 | 7 | **Keep** |

### Workstream C — Causal measurement

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| C1 | Randomized control arm | 10 | 9 | 8 | 10 | 9 | **Keep** |
| C2 | Incremental lift as the ranking quantity | 10 | 9 | 7 | 10 | 9 | **Keep** |
| C3 | No-listen baseline from `MoodEntry` pairs | 9 | 9 | 8 | 10 | 9 | **Keep** |
| C4 | User random effects / partial pooling | 8 | 6 | 4 | 9 | 6 | **Defer** |
| C5 | Valence × arousal | 9 | 8 | 6 | 10 | 8 | **Keep** |
| C6 | Confidence intervals everywhere | 8 | 9 | 8 | 10 | 9 | **Keep** |

### Workstream D — Bandit and OPE

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| D1 | Thompson sampling | 8 | 7 | 5 | 9 | 7 | **Keep** |
| D2 | Logged propensities | 10 | 10 | 9 | 10 | 10 | **Keep** |
| D3 | OPE harness gated in CI | 9 | 7 | 5 | 10 | 7 | **Keep** |
| D4 | LinUCB over embeddings | 7 | 5 | 3 | 8 | 5 | **Defer** |
| D5 | Habituation decay | 7 | 6 | 5 | 8 | 6 | **Modify** |
| D6 | Negative-effect guardrail | 9 | 8 | 7 | 10 | 8 | **Keep** |
| D7 | Differential privacy on population priors | 3 | 5 | 3 | 5 | 4 | **Remove** |

### Workstream E — Product

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| E1 | Proactive nudge at the predicted trough | 8 | 7 | 5 | 9 | 6 | **Modify** |
| E2 | Change-point detection | 5 | 5 | 4 | 7 | 5 | **Defer** |
| E3 | User-authored safety plan | 9 | 9 | 7 | 10 | 9 | **Keep** |
| E4 | Exploration transparency | 8 | 10 | 9 | 10 | 10 | **Keep** |
| E5 | "What works for me" export | 7 | 9 | 8 | 9 | 9 | **Keep** |
| E6 | Skip-as-signal | 8 | 7 | 6 | 9 | 7 | **Merge into B7** |

### Workstream F — Platform

| # | Proposal | Value | Feasibility | Simplicity | Fit | Maintainability | Call |
|---|---|---|---|---|---|---|---|
| F1 | Prompt registry + canary deploys | 7 | 7 | 5 | 8 | 7 | **Modify** |
| F2 | Agent evals | 9 | 8 | 6 | 10 | 8 | **Keep** |
| F3 | Red-team suite | 9 | 9 | 7 | 10 | 9 | **Keep** |
| F4 | Validate the judge (Cohen's κ) | 8 | 9 | 8 | 9 | 9 | **Keep** |
| F5 | Model / system cards | 7 | 10 | 9 | 9 | 10 | **Keep** |
| §8 | Enumerating privacy-sweep test | 10 | 10 | 9 | 10 | 10 | **Keep** |

---

## Phase 3 — How the retained items should change

### A3 — Persist runs, defer OpenTelemetry

**Modify.** `AgentRun`/`AgentStep` persistence is the load-bearing half: it makes
runs replayable, which is what makes the eval harness deterministic. Full OTel
with GenAI semantic conventions needs a collector and a backend nobody is
watching at this scale.

Ship the documents plus `utils/llmMetrics.js` extended to per-step granularity.
Keep span *shape* in the schema (`traceId`, `parentStepId`, `startedAt`,
`durationMs`) so exporting to OTel later is a serializer, not a migration.

### A5 + A10 — Two memory tiers, not four

**Merge and modify.** Four tiers with promotion and decay is more machinery than
the conversation volume justifies. Build:

- **Episodic** — one `MemoryItem` per turn-pair, summary + embedding + the mood
  at the time. The mood-context term in the hybrid score is the good idea here
  and it is nearly free, because `ListeningFeedback.moodAtTime` and
  `MoodEntry` already record exactly that dimension.
- **Profile** — the structured `UserModel` with confidence, provenance and
  `lastConfirmed`, promoted only when ≥2 episodic items agree.

Working memory is just the run document. Procedural memory folds into A11 below.

On Atlas Vector Search: it is the right call **only if the deployment is on
Atlas**. If Mongo is self-hosted anywhere in the pipeline, that dependency is
invisible until it fails in one environment. Verify first; the fallback — storing
embeddings and doing cosine in Node over a user's own few hundred memories — is
genuinely adequate at this scale and has no infrastructure cost.

### A9 — Two roles, not five

**Modify.** Five specialist agents means five prompts to version, five eval
suites, and five ways for hand-off to lose context — for a system with one
conversational surface.

Keep exactly two, because they differ in *kind*, not just in prompt:

- **Supervisor**, parallel with veto. This one must be separate; the doc's
  argument for it is correct and should be preserved verbatim.
- **Assistant**, one agent with the full tool registry. Tool availability already
  varies by intent through the context assembler's schema slot, which gets most
  of the benefit of specialisation without the coordination cost.

The Analyst-on-a-cheap-model idea is worth keeping as a *routing* decision inside
the one agent: if the router says the turn is purely factual about the user's own
data, run it on the fast model with temperature 0. That is a model choice, not a
separate agent.

### A11 — Procedural memory is the strongest memory idea; scope it tighter

**Modify.** The doc is right that this is the tier almost nobody builds and that
ZENOVA is unusually able to. But "strategies that worked" as free-text LLM
summaries would be unverifiable — the exact thing the verifier exists to prevent.

Make it a **derived view, not a memory**: a materialised aggregate over
`SessionOutcome` joined to `SongEffect`, keyed by `(user, startingMood,
therapeuticFunction)`. It is then a fact with an `n` and a confidence interval
that the verifier can re-derive deterministically, rather than a belief the model
asserted. Same product benefit, no hallucination surface.

### A14 — Defer the distilled classifier until there is data to distill

**Defer.** The plan needs 8–15k labelled turns. This system does not have 8–15k
turns. Training on a few hundred would produce a classifier with wide confidence
intervals on exactly the metric that matters — crisis recall — and shipping that
in front of the existing regex layer would be a safety regression.

Revisit at ~10k turns. Until then the two-layer cascade already in
`safetyService.js` is the right design, and the `degraded` rate is better
addressed by caching identical classifications and by the model failover that now
works.

### A15 — Remove MCP

**Remove.** Zero user value, and the "decouples from a vendor" argument does not
apply to a single-model app whose tools are all internal. It is a line on a CV
that an interviewer will read as scope-chasing next to the causal work, which is
the genuinely rare thing here.

### B6 — Cold start: population prior first, kNN later

**Modify.** kNN over persona space with 75 users means neighbourhoods of 3–5
people. The prior would be noise wearing a jacket.

Ship it in two steps. First, seed new users with a **genre-conditioned population
prior** — the aggregate effect for their top genres across all users, which is a
straightforward extension of the existing `SongEffect` aggregation. Add
persona-similarity weighting when there are enough users for a neighbourhood to
mean something (order 500+). The interface is the same either way, so this is a
weighting change later, not a rewrite.

### D5 — Habituation: measure it before modelling it

**Modify.** Restless bandits are the right frame eventually. Start by *detecting*
the effect: exponentially-discounted sufficient statistics in `SongEffect` (a
decay factor applied at write time, which the running-sums structure makes
trivial) plus a per-user play-count slope. Show the decay in the UI before
building a policy that reacts to it. If the decay does not appear in the data,
the sophisticated version was never warranted.

### D7 — Remove differential privacy

**Remove.** With ~75 users, Laplace noise calibrated for meaningful ε would
swamp the aggregate it protects. Worse, shipping DP at this scale invites the
question "what ε, and what does it buy?" — and the honest answer is "nothing
measurable." The existing consent gating, export and erasure are the coherent
privacy story; DP is not the next step, it is a different scale's step.

The stronger privacy work is already identified in §8: the enumerating erasure
test. That has caught a real gap in this codebase.

### E1 — Nudges: build the delivery primitive, gate the intelligence

**Modify.** The prediction ("your rough hour is 3pm") rests on a handful of
check-ins per user and will be wrong often. But the *delivery* mechanism is worth
building regardless and already has a proven pattern: `services/awardInbox.js`
tracks whether a notification was actually delivered and replays what was missed.
That generalises to any scheduled message.

Ship the notification substrate with a hard 1/day cap and a silence switch;
drive it from something certain first (a streak about to lapse, an unanswered
after-rating from yesterday) and switch the trigger to the predicted trough only
once there is enough data for the prediction to beat a fixed time.

### F1 — Registry yes, canary later

**Modify.** Versioning prompts and tool descriptions in git with a registry is
cheap and immediately useful for evals. Canarying to 5% of traffic requires
traffic; with the current volume a 5% arm would take months to reach
significance. Build the registry, run the offline eval gate, and add the online
arm when there are enough sessions per week to resolve it.

---

## Phase 4 — What the document missed

Everything here is grounded in a file in this repo.

### M1 — The ledger is invisible to users ⭐

`services/songEffectService.js` is the product's differentiator and it is read in
exactly one place: `recommendationService.js`, for ranking. `grep` across
`controllers/` and `routes/` finds no endpoint that exposes it.

So the app measures which songs help, and then never tells anyone. A **"Proven
for you"** surface — songs with their measured lift, sample size and provisional
flag — is the single highest value-per-hour item in this entire review. The data
exists, the estimator exists, the honesty conventions exist. It needs an endpoint
and a screen.

It is also the natural home for E4 (exploration transparency) and C6 (intervals),
and it makes the causal work in Workstream C *visible* rather than internal.

### M2 — There is no user timezone, and it silently breaks three features ⭐

`utils/dayKey.js` accepts a `timeZone` and `pointsService.updateStreak` accepts
`{ timeZone = "UTC" }` — but nothing ever passes one. The only production caller
is `gamificationMiddleware.js:90`, which passes none. There is no timezone field
on `models/user.js`.

Consequences today:
- Every user's streak rolls over at **UTC midnight**. In India that is 05:30
  local, so a late-evening check-in and the next morning's land on the same
  "day" and the streak does not advance.
- `moodInsightsService` buckets the chart by calendar day but derives
  day-of-week and hour with `getDay()`/`getHours()` — **server** local time,
  which on Render is UTC.

And it blocks the handoff's own §3.4 circadian profile and §6.1 nudge: both are
time-of-day features built on a clock that is not the user's.

**Fix:** add `timeZone` to the user model, capture it at registration from
`Intl.DateTimeFormat().resolvedOptions().timeZone`, thread it through `dayKey`
and the insights bucketing. Small, and a prerequisite for a chunk of Workstream B
and E.

### M3 — `moodAtTime` is collected and never used

`ListeningFeedback.moodAtTime` is written on every rating and read back only by
`privacyService` for the export. Nothing aggregates it.

This is a free contextual dimension already accumulating: *which songs get liked
when the user is low*, as distinct from liked in general. It is the same
`(song × starting state)` shape the effect ledger uses, so `buildTasteProfile`
can condition on it with one extra `$group` key — turning one taste profile into
a per-mood taste profile at almost no cost.

### M4 — The "why" is generated and thrown away

`recommendationService` returns `therapeuticGoal` and a per-song `reason`, and
persists them on `Recommendation.recommendedMusic[]`. Neither is rendered
anywhere in `frontend/src`.

The explanation is what separates this from a playlist generator, and it is
already being produced and paid for. Rendering it is a frontend-only change.
`energyLevel` and `therapeuticFunction` are likewise stored per song and never
used in ranking or display.

### M5 — Two dead models

- `models/TherapySession.js` is imported only by `privacyService` to delete it.
  Nothing writes it. Either use it as the agent's run log (it is close to the
  right shape) or delete it — dead collections in an erasure sweep are a
  maintenance trap.
- `MusicResource.audioFeatures` is a declared subdocument no code writes,
  a leftover from the Spotify endpoints §3.3 warns about. Drop it, and let the
  CLAP work define its own field.

### M6 — `TaskLock` already solves the scheduling problem

`models/TaskLock.js` and the debounce in `leaderboardService.js` are a working
Mongo-backed distributed lock. The recently-played poller (B4), the memory
compaction job (A10) and the nightly baseline recompute (C1) all need exactly
this. **Do not add a queue or a scheduler dependency** — extend the primitive
that is already proven in this codebase.

### M7 — `PointAward` is the template for `Impression`

The doc's `Impression` collection with logged propensities (D2) has a direct
precedent: `models/PointAward.js` is an append-only per-event ledger with a
unique anti-replay index, and `leaderboardService` aggregates it over ISO-week
and month keys. `Impression` should be modelled on it exactly — same shape, same
aggregation idiom, same index discipline. That makes D2 a *day* of work rather
than a design exercise.

### M8 — No operational surface at all

There is no admin view of anything: LLM spend, `degraded` rate, eval history,
failed runs, or the ledger's coverage. `utils/llmMetrics.js` collects metrics and
`/api/health/llm` exposes a snapshot, but there is no UI and no history.

Once the agent is spending real money per turn, an internal dashboard stops being
a nice-to-have. This is also the cheapest possible demonstration of production
thinking.

### M9 — Cost limiting is per-route, not per-user

`config/security.js` rate-limits requests. Nothing caps a single user's LLM
*spend*. An agent with a tool loop makes that materially riskier than one call
per turn — the doc's budget layer (A16) covers the per-run case, but a per-user
daily cost ceiling is the one that protects the bill.

### M10 — Accessibility of the primary input

`MoodScale` is the most-used control in the product and carries four
aria/role attributes total. It should be a labelled radio group with keyboard
arrow navigation. Before adding the valence-arousal grid (C5) — a 2-D control
that is *harder* to make accessible — the 1-D one should be right.

---

## Phase 5 — Feasibility for the recommended set

Condensed to the items that made Must Have and High Impact. Complexity is
Small / Medium / Large / Very Large.

### C1 + C2 — Control arm and incremental lift

**Problem.** A user who rates 2 and later 4 would often have risen anyway.
Regression to the mean, natural recovery and the demand effect of having opened a
wellbeing app all inflate Δ, and 100% of it is currently credited to the song.

**Why it fits.** `recordSessionEffect` in `songEffectService.js` is already the
single write point for outcome data, and `SessionOutcome` already stores
`moodBefore`, `moodAfter` and `detectedMood`. The control arm is a branch at
candidate selection plus one extra field.

**Files.** `services/recommendationService.js` (arm assignment),
`models/SessionOutcome.js` (`arm`, `policyVersion`), new `models/BaselineCell.js`,
`services/songEffectService.js` (lift computation), `services/privacyService.js`
(sweep).

**Backend.** Assign `arm: "control" | "policy"` at recommendation time behind a
flag at 5%. Control serves a diverse held-out pool. Accumulate baseline
statistics per `(startingMood, hourOfDay, dayOfWeek)` — which needs M2's user
timezone to be meaningful. Rank by `lift = shrunkDelta − baseline(cell)`; store
both, never overwrite the raw.

**Frontend.** None required; pairs naturally with E4's exploration label.

**Database.** `BaselineCell`; two fields on `SessionOutcome`.

**Risks.** 5% of sessions are deliberately unoptimised. Cells will be sparse for
months — surface baselines as provisional using the convention already
established for songs.

**Complexity:** Medium.

### C3 — No-listen baseline

**Problem.** The control arm is slow to fill. A second, free control group
already exists.

**Why it fits.** `MoodEntry` records check-ins independent of sessions. Users who
check in twice with no session between are an observational control.

**Files.** `services/moodInsightsService.js` (the pairing query),
`services/songEffectService.js` (blend into `BaselineCell`).

**Backend.** Mine `MoodEntry` pairs at matched time gaps, exclude any window
overlapping a `SessionOutcome`, feed as a second baseline estimate with lower
weight than the randomized arm — it is observational, not randomized, and should
be labelled as such wherever it is surfaced.

**Complexity:** Small.

### D2 — Logged propensities

**Problem.** Without the probability each candidate was served with, past
sessions can never evaluate a future policy.

**Why it fits.** Directly modelled on `PointAward` (M7). It is an append-only
write on a path that already exists.

**Files.** New `models/Impression.js`, `services/recommendationService.js`,
`services/privacyService.js`.

**Backend.** On every recommendation, write one `Impression` per served
candidate: `userId`, `musicId`, `sessionId`, `policyVersion`, `propensity`,
context features, `arm`. Deterministic propensity is 1/n for the current ranker —
log it anyway, because the value is in never having to backfill.

**Risks.** Volume: n rows per recommendation. Index on `(userId, createdAt)` and
plan a TTL or archive before it matters.

**Complexity:** Small. **Highest ratio of future optionality to effort in this
document.**

### A1 + A2 + A13 — Registry, server-side history, taint

**Problem.** Three distinct ones. Tools need typed dispatch. Client-posted
history is a real hole. Tool output is a bigger injection surface than the
message.

**Why it fits.** `ctx.userId` from the session mirrors the rule already enforced
in `socketManager.js`, where identity comes from `socket.data` and never from the
payload. The same discipline, one layer up.

**Files.** New `services/agent/`, `models/AgentRun.js`, `AgentStep.js`,
`ToolAudit.js`; `utils/untrustedContent.js` (reuse for tool results);
`prompts/conversationPrompt.js` and `controllers/geminiController.js` (history
moves server-side); `hooks/useChatMessages.js` (stops posting history).

**Backend.** Declarative registry with input/output schemas, `sideEffect`,
`scopes`, `ownership`. `toolAuth` checks before dispatch, never inside handlers.
Wrap every tool result in the existing boundary. Mark a run `tainted` once it
ingests third-party text — playlist names from collaborators are the live vector,
and shared playlists exist today.

**Frontend.** Stop sending `conversationHistory`. Confirmation UI for write
tools.

**Risks.** Moving history server-side changes the chat contract; ship behind the
flag with the old path intact.

**Complexity:** Large.

### A7 — Grounding verifier

**Problem.** An agent that states numbers about a user's own history must not
invent them.

**Why it fits.** This is the strongest item in the handoff and it is strong
*because of this repo specifically*: the claims are numbers from our own
database, so verification is deterministic rather than an LLM judge. Almost
nobody can say that.

**Files.** `services/agent/verifier.js`, `AgentStep` (recorded tool outputs).

**Backend.** Model emits `[ref:stepId]` on claims; verifier re-derives each value
from the recorded output and compares. Mismatch → regenerate once with the
discrepancy fed back; second mismatch → strip the claim. Report a verification
rate as a first-class metric.

**Complexity:** Medium — and it depends on A1/A3 being done first.

### M1 — Surface the ledger

**Problem.** The product's central claim is invisible.

**Files.** New `GET /api/wellbeing/proven`, `controllers/wellbeingController.js`,
`services/songEffectService.js` (already returns everything needed), a new page
or an Insights section.

**Backend.** One read endpoint returning ranked effects with `n`, interval and
provisional flag, scoped to the user with population fallback.

**Frontend.** A list with an effect bar and honest labelling — the `unknown`
trend convention in `Insights.jsx` is the precedent for how to say "not sure
yet."

**Complexity:** Small.

### M2 — User timezone

**Files.** `models/user.js`, `middlewares/gamificationMiddleware.js`,
`services/moodInsightsService.js`, `frontend/src/pages/Register.jsx`,
`hooks/` for the client-side capture. A backfill script in the established
dry-run/`--commit` shape.

**Risks.** Backfilling changes existing streak boundaries once. Do it in the same
migration that adds the field and state the effect.

**Complexity:** Small.

### C5 — Valence × arousal

**Problem.** A 1–5 scale cannot distinguish "I need to be calmer" from "I need
more energy" — opposite prescriptions that currently produce the same input.

**Why it fits.** The handoff is right that this is the biggest product upgrade in
it. Music maps onto arousal far more naturally than onto a single goodness axis.

**Files.** `models/MoodEntry.js`, `SessionOutcome.js`, `MoodScale.jsx`,
`SessionCheckIn.jsx`, `moodInsightsService.js`, `songEffectService.js`
(cell key becomes 2-D).

**Migration.** Additively, exactly as the doc says: keep the 1–5 field, add the
2-D field, backfill valence from the existing scale with arousal null. Do M10's
accessibility work on the 1-D control first.

**Risks.** The effect ledger's cell key changes, which fragments existing
observations. Keep both keys and run the 2-D estimate as provisional until it has
its own volume.

**Complexity:** Medium.

### E3 — User-authored safety plan

**Problem.** A generic helpline card at a hard moment is the weakest possible
intervention.

**Why it fits.** `safetyService` already decides *when* someone is at elevated
risk and already routes region-aware resources. The plan changes *what* is shown
at that moment, using content the person wrote while calm.

**Files.** New `models/SafetyPlan.js`, `services/safetyService.js`,
`components/CrisisSupport.jsx`, Settings for authoring, `privacyService.js`.

**Risks.** This is the most sensitive data in the system. Encrypt at rest, never
send it to the model, and render it verbatim — the person's own words, not a
summary. Helplines remain the backstop.

**Complexity:** Medium.

### §8 — Enumerating privacy-sweep test

**Problem.** A new collection with a `userId` can silently escape erasure.

**Why it fits.** This is not hypothetical here. Before this session,
`deleteAccount` left `PointAward`, `RefreshToken`, `PlaylistInvitation` and
cached leaderboard rows behind. A test that enumerates `mongoose.models` at
runtime and fails on any user-keyed collection missing from the sweep would have
caught all four.

**Complexity:** Small. **Build it before any of the twelve new collections
land**, not after.

---

## Phase 6 — Prioritisation

### Must Have — high value, low or medium effort

| Item | Why |
|---|---|
| §8 enumerating privacy test | Twelve new user-keyed collections are proposed. Build the guard first. |
| M2 user timezone | Silently wrong today; blocks every time-of-day feature downstream. |
| M1 surface the ledger | The differentiator is invisible. Data and estimator already exist. |
| D2 logged propensities | One collection, one write, permanent optionality. |
| C1 + C2 control arm and lift | Makes every number in the product causally meaningful. |
| C3 no-listen baseline | Free control group already sitting in `MoodEntry`. |
| E4 exploration transparency | Copy change plus a flag; defuses odd recommendations. |
| A13 taint + wrap tool output | Collaborator-named playlists are a live vector today. |
| M4 render the reason | Already generated, stored and paid for. Frontend only. |

### High Impact — high value, higher effort

| Item | Why |
|---|---|
| A1 + A2 registry, auth, server-side history | The agent's foundation, and closes a real hole. |
| A7 verifier + grounding | The most distinctive engineering in the plan. |
| A6 supervisor as parallel veto | Preserves the safety guarantee under an agent loop. |
| C5 valence × arousal | Biggest product upgrade; changes what can be prescribed. |
| B4 + B7 listening stream and skips | Densifies a sparse ledger with passive signal. |
| B2 real playback | Removes the biggest free-tier limitation. |
| D1 + D3 Thompson sampling + OPE gate | Turns a ranker into an evaluable policy. |
| F2 + F3 agent evals and red-team | Without these the agent is undemonstrable. |

### Nice to Have

B1 incremental scopes · B5 persona · D6 negative-effect guardrail · E5 export ·
F4 judge validation · F5 model cards · M3 mood-conditioned taste · M8 ops
dashboard · M9 per-user cost cap · M10 accessibility.

### Future Vision

A5 + A10 memory · A8 planner · A11 procedural view · B6 kNN cold start ·
C4 random effects · D4 LinUCB over CLAP embeddings · D5 habituation ·
E1 predictive nudges · E2 change-point detection · A14 distilled classifier.

### Not recommended

A15 MCP (no value here) · D7 differential privacy (wrong scale) ·
A9 as specified (five agents; ship two) · B3 playlist sync (reconciliation cost
exceeds the benefit until users actually edit on Spotify's side).

---

## Phase 7 — Roadmap

Ordered by dependency, not by interest. Each phase ends somewhere shippable.

### Phase 1 — Foundation (weeks 1–3)

Enumerating privacy test → user timezone + backfill → `Impression` with
propensities → control arm at 5% → no-listen baseline → lift as the ranking
quantity.

*Why first:* the privacy guard must precede the new collections. Timezone must
precede anything hour-shaped. Propensity logging must precede any policy you want
to evaluate against history — every session that runs before it is permanently
lost as evaluation data.

*Ships:* the causal substrate. Nothing user-visible changes.

### Phase 2 — Make the measurement visible (weeks 4–6)

Surface the ledger ("Proven for you") → intervals and provisional labelling
throughout → exploration transparency → render `therapeuticGoal` and per-song
reasons → mood-conditioned taste profile → `MoodScale` accessibility.

*Why here:* Phase 1 produces numbers worth showing, and showing them is mostly
frontend work against endpoints that already exist. This is also the phase that
makes the project *demonstrable* — the causal work becomes something you can
point at rather than describe.

*Ships:* the differentiator becomes the product's face.

### Phase 3 — Spotify depth (weeks 7–10)

Incremental scopes → real playback with device transfer → recently-played poller
on `TaskLock` → `ListeningEvent` accumulation → skip detection → persona
derivation → genre-conditioned cold-start prior.

*Why here:* the poller needs the timezone from Phase 1 for its circadian
histogram to mean anything, and skip signals need `Impression` to attach to.

*Ships:* real playback, and personalisation from session one.

### Phase 4 — The agent (weeks 11–18)

Tool registry + `toolAuth` → server-side history → `AgentRun`/`AgentStep` →
budgets and breaker → read tools → parallel supervisor → verifier and grounding
contract → write tools with confirmation and `ToolAudit` → agent and red-team
evals in CI → episodic memory.

*Why last of the big four:* the agent's value depends on having tools worth
calling. Built after Phases 1–3, its ledger tools return causally valid numbers
and its Spotify tools reach a real account. Built first, it would be a chat
wrapper over an empty database.

*Ships:* a demonstrably agentic system with an eval gate.

### Phase 5 — The model layer (weeks 19+)

CLAP embeddings from the 510 resolved previews → Thompson sampling → OPE harness
gated in CI → negative-effect guardrail → habituation decay → valence-arousal
migration → safety plan → model cards.

*Why last:* every item needs volume that only accrues once Phases 1–4 are live,
and the OPE gate is meaningless until there are logged impressions to evaluate
against.

---

## Closing note on framing

The handoff's §10 is right that with this much data the effect sizes are
preliminary and the *methodology* is the contribution. That framing should be
stated in the README, not just held privately — a system that reports honest
uncertainty about its own claims is a stronger artifact than one that overstates
them, and it is consistent with what the code already does everywhere else: the
`provisional` flag on song effects, `unknown` on trends, `degraded` on the safety
classifier, and `curated` when recommendations are stand-ins.

That consistency is the actual through-line of this codebase. The v2 work should
extend it, not break it.
