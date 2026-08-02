# Model & System Cards

One page per model-backed component: what it is for, what it was built from,
how it is evaluated, and where it fails. Written because a system that states
its own limits is easier to trust than one that does not, and because "what
happens when this is wrong" should have an answer before anyone asks.

Dates are the last time the section was reviewed against the code.

---

## 1. Crisis risk classifier

**Reviewed:** 2026-08-02 · **Files:** `services/safetyService.js`, `evals/runSafetyEval.js`

### Intended use
Deciding whether a message indicates risk of self-harm, so the response can be
support contacts rather than music. Decision support and signposting only.

### Explicitly not intended for
Assessment of a person, triage, diagnosis, or any use where a clinician would
otherwise be involved. It classifies a message, not a human being.

### How it works
Two layers with different jobs. A deterministic regex layer gives precision and
cannot be argued out of a decision — it covers euphemisms (`kys`, `unalive`,
`kms`) with a lookbehind so "I ran 5 kms" does not trip it. An LLM classifier
then catches phrasings no pattern anticipated. Either firing is enough.

### Evaluation
`npm run eval:safety` against a hand-labelled dataset. Gated on **crisis
recall** — a missed crisis fails the run outright, where a false positive only
costs precision. Also fails if more than 15% of classifications came back
`degraded`, because a rate-limited classifier silently returning "none" would
otherwise score 100%.

Last recorded run: 44/44, 0% degraded.

### Known failure modes
- **Irony and fiction.** "I could just die" and a quoted song lyric both look
  like disclosure. The bias is deliberately toward false positives.
- **Languages other than English.** The regex layer covers English only; the
  LLM layer is better but untested outside English.
- **Indirect disclosure.** "I've written some letters" carries meaning the
  system will not catch.
- **A degraded classifier.** When the LLM layer fails, the regex layer stands
  alone and recall drops. The response is marked `degraded` rather than
  presented as a clean result.

### What happens when it is wrong
False positive: the user is shown helplines they did not need, which is
annoying and safe. False negative: the deterministic layer is the backstop, the
disclaimers stand, and `/api/wellbeing/support` is public so contacts are always
one click away regardless of what any classifier decided.

---

## 2. Song-effect estimator

**Reviewed:** 2026-08-02 · **Files:** `services/songEffectService.js`, `services/baselineService.js`

### Intended use
Estimating how much a song changed self-reported mood for people who started in
a given state, and ranking recommendations by it.

### How it works
Running sufficient statistics per `(song, starting mood, starting arousal)`,
updated atomically. Ranking uses a **shrinkage estimator** with a Bayesian
zero-effect prior — `sumDelta / (n + prior)` — because five identical +3 ratings
have zero measured variance, so a naive confidence bound collapses and thin
evidence outranks strong.

`lift` subtracts a **baseline** for the same context, estimated from a
randomized control arm (5% of sessions, served without the ranking) and from
check-in pairs with no session between them. Randomized evidence is weighted at
1.0, observational at 0.35, never pooled.

### Evaluation
`tests/integration/songEffect.test.js` and `causalSubstrate.test.js`, including
concurrency tests that fire simultaneous completions and assert nothing is lost.

### Known failure modes and limitations
- **Sample size.** With the current user base every cell is provisional. The
  `evidence` field says so and the UI renders it; nothing here should be read as
  established.
- **Self-report.** Mood is what someone says it is. Demand effects — people who
  chose to open a wellbeing app want it to have worked — are real and the
  control arm only partially removes them.
- **Selection into sessions.** Who completes an after-rating is not random.
  Someone who felt worse may simply close the tab.
- **The no-listen baseline is observational.** People who do not open a session
  may differ systematically from those who do. Weighted down and labelled, not
  treated as randomized.
- **Cold start.** A song with no observations has no estimate, and Thompson
  sampling will surface it precisely because of that uncertainty.

### What happens when it is wrong
A song is ranked above one that would have helped more. There is no safety
consequence except through the negative-effect guardrail, which suppresses songs
whose measured effect at low mood is reliably negative — and which requires both
the shrunk mean *and* the upper interval bound to be negative before acting.

---

## 3. Recommendation model (Gemini)

**Reviewed:** 2026-08-02 · **Files:** `services/geminiService.js`, `prompts/recommendationPrompt.js`

### Intended use
Proposing candidate songs and a therapeutic goal from a message, a taste
profile, and the measured-effect list.

### Model
`gemini-3.5-flash`, with `gemini-3-flash-preview` and `gemini-flash-lite-latest`
behind it. Structured output via `responseSchema`. Verified with
`npm run verify:models`, which asks the API which models exist rather than
inferring it from whether a request happened to succeed.

### Known failure modes
- **Hallucinated songs.** The model can name tracks that do not exist. They are
  resolved against Spotify and dropped when unmatched, so a hallucination
  becomes a missing row rather than a dead link.
- **Silent failover.** A quota-exhausted primary would previously fall through
  invisibly. `llmMetrics` now records which model actually answered and a
  fallback rate per operation.
- **Prompt injection.** Both the message and the conversation history are
  wrapped in a per-process random delimiter. Tool output is wrapped too, and a
  run that ingests third-party text loses every mutating tool.
- **Generic fallback.** When generation fails a fixed catalogue is served, and
  the response carries `curated: true` so the client can say so rather than
  passing stand-ins off as personalised.

---

## 4. The assistant (agent)

**Reviewed:** 2026-08-02 · **Files:** `services/agent/`

### Intended use
Answering questions about the user's own measured history and making changes
they have agreed to.

### Guarantees, and how each is enforced
| Guarantee | Mechanism |
|---|---|
| Cannot act as another user | `ctx.userId` from the verified session; no tool accepts a `userId` and the registry rejects one |
| Cannot touch another user's data | `toolAuth` checks ownership as a database query, before dispatch |
| Cannot change anything unasked | Writes are proposed and carried out only on redemption of a single-use token |
| Cannot be steered by third-party text | A run that reads it is `tainted` and loses every mutating tool |
| Cannot invent numbers | The verifier re-derives every cited value from recorded tool output and strips what it cannot support |
| Cannot bypass safety | The supervisor runs in parallel on the raw turn and holds a veto |
| Cannot run away with cost | Per-run step/token/cost/time caps and a per-user daily ceiling |

### Evaluation
`tests/integration/agent.test.js` and `agentRedTeam.test.js`. Authorization and
supervisor bypasses are asserted as hard gates — zero successes, not a score.
The red-team suite found a real authorization hole on its first run.

### Known failure modes
- **Verification only covers numbers.** A qualitative claim ("that seems to
  help you") carries no reference and is not checkable.
- **The trigram embedding is not a language model.** Memory retrieval matches
  lexical overlap, so a paraphrase may not recall the right memory.
- **Taint is conservative.** Reading any third-party field disables writes for
  the whole run, which will sometimes be more restrictive than necessary.
- **No planner.** Multi-step goals are handled by iterating rather than by an
  explicit plan, so a long task can exhaust the step budget and degrade.

---

## 5. Musical taste profile (persona)

**Reviewed:** 2026-08-02 · **Files:** `services/personaService.js`

### Intended use
A cold-start prior and an exploration parameter, derived from real listening
history.

### Explicitly not intended for
Any claim about the person. The research linking music preference to personality
shows real but modest correlations — nowhere near strong enough to tell someone
what kind of person they are. This is a taste profile, and the code, the UI copy
and this card all say so.

### How it works
Rank-weighted genre affinities from accumulated `ListeningEvent` records, plus
taste drift, a mainstream index and a circadian histogram in the user's own
hours. Shannon entropy over genres and artists sets the Thompson sampling
temperature: concentrated taste is respected with low exploration, wide-ranging
taste gets more.

### Known failure modes
- **Thin history.** A profile built on a handful of plays is pulled back toward
  the default temperature rather than driving a strong decision.
- **Shared accounts.** One Spotify account used by two people produces a profile
  describing neither.
- **Genre labels are Spotify's.** They are inconsistent and occasionally strange,
  and they are now the only source of genre since the audio-feature endpoints
  were withdrawn.

---

## Standing limitations of the whole system

**The effect sizes are preliminary.** With the current volume every measured
result is provisional, and the methodology is the contribution rather than the
numbers. That is stated here rather than held privately.

**Nothing here is clinical.** No component assesses a person. Everything that
touches mood or risk is worded as observation and signposting, escalation is
deliberately conservative, and the support endpoint is public so contacts never
depend on the rest of the system working.

**Honest uncertainty is a convention, not an accident.** `provisional` on song
effects, `unknown` on trends, `degraded` on the classifier and on truncated
agent runs, `curated` when recommendations are stand-ins, `exploring` on a
sampled pick. Anything added should extend that vocabulary rather than break it.
