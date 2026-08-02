# Guided Listening Plans — Design

A user picks a length and a goal. ZENOVA builds a day-by-day plan, tracks
whether it's working, watches how they actually behave, changes the plan when
the evidence says to, and ends with a measured answer about what shifted.

This document is the design, the honest risks, and the build order.

---

## 0. What this must never be

**Not a treatment programme.** "Follow this 4-week plan to fix your anxiety" is
a clinical claim and ZENOVA cannot make it. The framing everywhere — model
names, UI copy, notifications — is a **listening plan**: a structure for using
the app, with measurement attached. Not a course of therapy, not an
intervention, not a protocol.

So: it is called a **Plan** in the UI and `ListeningPlan` in code. Never
"programme", "treatment", "protocol", or "therapy plan".

**Not a streak.** ZENOVA has streaks and they work well for daily check-ins.
They must not extend to a plan. A person who misses four days of a wellbeing
plan is often having a bad week, and "you broke your 12-day streak" at that
moment is actively harmful. Missed days are neutral, silent, and rescheduled.

**Not pressure when things get worse.** The single most important rule in the
adaptation engine: if the measured trend goes *down*, the plan does not push
harder. It softens, surfaces the safety plan, and says something honest.

---

## 1. Why this fits ZENOVA specifically

A guided plan is a generic wellness-app feature. Four things already in this
codebase make it something else:

| What exists | What it lets the plan do |
|---|---|
| **Before/after measured sessions** | Progress is *measured*, not self-reported completion. "You did 12 of 14 sessions" is adherence; "sessions at low mood now move you +1.4, up from +0.6" is progress, and they are different. |
| **The effect ledger + lift** | The plan adapts on causal evidence about this person, not on engagement. It can drop a prescription because it measurably isn't working for them. |
| **Valence × arousal** | The goal can be a *coordinate* — "calmer at the same mood" is a direction on the arousal axis, and it is checkable. A single scale could not express it. |
| **`ListeningEvent`, `Impression`, skips, ratings** | Behaviour is already being recorded passively. The plan doesn't need new instrumentation to see that someone always does their evening session at 11pm, not the 9pm it suggested. |

Plus the bandit for what to actually play, the agent for the coaching voice, and
the verifier so the coach cannot invent progress that didn't happen.

**The one-sentence version:** a closed-loop plan whose target is a measured mood
coordinate, whose adaptations are triggered by causal evidence rather than
engagement, and whose every change is logged with the reason that caused it.

---

## 2. The user's experience

### Enrolment

1. **Pick a direction.** Not a free-text goal — a small fixed set, because each
   maps to a measurable target:
   - *Wind down at night* → lower arousal in the evening
   - *Get going in the morning* → raise arousal early
   - *Steadier week* → reduce valence variance
   - *Lift a low stretch* → raise mean valence

2. **Pick a length.** 1, 2, or 4 weeks. Shorter than a week can't show a trend;
   longer than four is a commitment people abandon.

3. **See the target, and where it came from.** This is the part that matters.
   The target is derived from *their own history*, not a generic ideal:

   > Over the last 90 days your best week averaged **3.8**. Right now you're
   > averaging **2.6**. The plan aims at 3.4 — most of the way back to a level
   > you've actually reached before.

   A target someone has already hit is achievable and honest. "Be happy" is
   neither. If there isn't enough history to derive one, say so and offer a
   modest fixed target instead of inventing a personal one.

4. **See the shape.** The days, what each asks for, roughly when. Editable
   before starting — someone who knows they can't do mornings should say so now.

### Day to day

Each day has at most one **step**, and a step is a measured session: rate, listen,
rate. That's it. The plan's whole job is deciding *when*, *what kind*, and
*what to play*.

- Steps are due, not overdue. A missed step is rescheduled once, silently.
- A "rest day" is a real step type. Plans that ask for something every single day
  get abandoned.
- One notification per day maximum, at the hour they actually listen, and it can
  be turned off without turning off the plan.

### The end

Not a "congratulations". A **read-out**:

> **Two weeks, 11 of 14 sessions.**
> Evening sessions moved you −1.2 on arousal on average (n=7) — that's the
> direction you were aiming for.
> Mornings did nothing measurable (n=2, too few to say).
> Your steadiest hour turned out to be 10pm, not the 9pm we started with.

And an offer: repeat, extend, adjust, or stop. Stopping is a normal outcome
presented as one.

---

## 3. Data model

### `ListeningPlan`

```js
{
  userId,
  direction: "wind_down" | "get_going" | "steadier" | "lift",
  durationDays: 7 | 14 | 28,

  status: "draft" | "active" | "paused" | "completed" | "stopped",

  // Where they were, derived from history at enrolment.
  baseline: { valence, arousal, samples, from, to },

  // Where they're aiming. Derived, with its provenance stored so the UI can
  // explain it rather than assert it.
  target: {
    valence, arousal,
    basis: "personal_best_week" | "modest_default",
    evidence: { bestWeekMean, currentMean, samples },
  },

  startedAt, endsAt, completedAt,

  // Every change, with what caused it. This is the audit trail that makes the
  // adaptation policy inspectable rather than magic.
  adaptations: [{
    at,
    trigger: "low_adherence" | "time_drift" | "no_measured_effect"
           | "deterioration" | "rapid_improvement",
    evidence,          // the numbers that fired the rule
    change,            // human-readable, shown to the user
  }],
}
```

### `PlanStep`

```js
{
  planId, userId,
  dayIndex,
  dueAt,                       // in the user's timezone
  kind: "session" | "check_in" | "rest",

  // What kind of shift this step is for, which selects the songs.
  prescription: {
    therapeuticFunction,       // "calm" | "energize" | "support" | ...
    targetArousalShift,        // -1, 0, +1
  },

  status: "pending" | "done" | "missed" | "rescheduled" | "skipped",
  sessionId,                   // the Recommendation this step became
  outcomeId,                   // the SessionOutcome, once measured
  completedAt,
}
```

Separate collection rather than an embedded array: steps are queried by due
date across users for the scheduler, and an embedded array would mean scanning
every plan.

### `PlanBehaviour` — derived, rebuildable

Not a new source of truth. A materialised view over data already collected, so
the adaptation engine reads one document instead of five aggregations:

```js
{
  planId, userId, computedAt,
  adherence: { due, done, missed, rate },
  timing: { scheduledHourMean, actualHourMean, drift },
  engagement: { sessionsAbandoned, skipRate, ratingsGiven },
  effect: { meanLift, meanArousalShift, samples },
  trend: { direction: "up" | "flat" | "down" | "unknown", slope, samples },
}
```

---

## 4. How the plan is built

### Timing comes from behaviour, not from a template

The circadian histogram in `SpotifyPersona` already knows when this person
listens. A 9am step for someone who never opens the app before 8pm is a step
that will be missed. Schedule into their existing pattern; the plan should fit
the life, not the reverse.

Without a persona, fall back to the insights' *roughest time of day* — which
already exists and is exactly the hour a session is most likely to help.

### Content comes from the ledger, with room to explore

Each step's songs come from `rankWithExploration` at the step's starting state,
with the exploration temperature already set by the user's listening entropy.

One addition: **plans should explore more early and exploit more late.** Week one
of a 4-week plan is when unknown songs are cheap to try; week four is when the
plan should be playing what it has learned. A simple decay on the temperature
across the plan's length does this, and it makes the plan visibly get better,
which is the experience you want.

### Density adapts to the length

A 7-day plan is 5 sessions and 2 rests. A 28-day plan is not 20 sessions — it's
roughly 3 a week with rests, because the failure mode of a long plan is
abandonment, not insufficient dosage.

---

## 5. The adaptation engine

Rules, each with an explicit trigger, an evidence threshold, and a logged
change. No LLM decides whether to adapt — a model may *word* the change, but the
decision is deterministic and auditable.

| Trigger | Fires when | Change | Why |
|---|---|---|---|
| **Low adherence** | < 50% of steps done over 3+ consecutive due days | Reduce frequency by one step per week; keep the target | The plan is too demanding. Lowering the ask is more likely to work than repeating it louder. |
| **Time drift** | Mean actual hour differs from scheduled by > 2h over 4+ steps | Move future steps to the actual hour | They've told you when they'll do it, by doing it. |
| **No measured effect** | A prescription type shows lift ≤ 0 over ≥ 5 measured sessions | Stop prescribing that type; shift weight to what does work | This is the causal evidence earning its place. |
| **Rapid improvement** | Rolling mean reaches target with ≥ 5 samples, before the end | Offer to graduate early | Padding out a plan that already worked is dishonest. |
| **Deterioration** ⚠️ | Rolling mean drops ≥ 0.8 below baseline over ≥ 4 samples | Reduce to rest + check-ins, surface the safety plan, suggest talking to someone | **Never push harder.** A plan is not the right tool for a week that is getting worse, and pretending otherwise is the most harmful thing this feature could do. |

Every adaptation is written to `plan.adaptations` and **shown to the user in
plain language**, because a plan that silently rearranges itself is one nobody
can trust:

> *We moved your evening sessions from 9pm to 10:30pm — that's when you've
> actually been listening.*

### The rule about rules

Adaptation runs on the nightly scheduler, not inline, so a slow evaluation never
delays a user's session. It reads `PlanBehaviour`, which is rebuilt from
existing collections — meaning the whole engine can be re-run over history to
test a rule change before shipping it.

---

## 6. Behaviour tracking — all of it already collected

| Signal | Source | Already exists |
|---|---|---|
| Did they complete the step | `SessionOutcome.completedAt` | ✅ |
| Did they start and abandon it | `listenedAt` set, `moodAfter` null | ✅ |
| When they actually did it | `SessionOutcome.hourOfDay` (user timezone) | ✅ |
| What they skipped | Spotify playback polling | ✅ |
| What they rated | `ListeningFeedback` | ✅ |
| What they listened to *outside* the plan | `ListeningEvent` | ✅ |
| Which songs were served and with what probability | `Impression` | ✅ |
| Whether it worked | `SessionOutcome.lift` | ✅ |

**No new instrumentation is required.** That is the strongest argument for
building this: the measurement substrate was built first, and this is the
feature that consumes it.

---

## 7. The agent's role

The assistant becomes the plan's voice, using tools rather than a special mode:

- `get_my_plan` — where they are, what's next
- `explain_my_progress` — reads `PlanBehaviour`, subject to the **verifier**, so
  it cannot claim an improvement the numbers don't show
- `adjust_my_plan` — write, confirmed, and only within the same rules the
  engine uses; the model cannot invent an adaptation the policy wouldn't make
- `pause_plan` / `stop_plan` — write, confirmed, no friction, no guilt copy

The verifier matters more here than anywhere else in the app. "You're doing
really well" is unfalsifiable; "your evening sessions moved you −1.2 on arousal
across 7 measured sessions" is checkable, and the verifier deletes it if the
number isn't in the tool result.

---

## 8. Safety

- The **supervisor** already runs on every turn and is unchanged. A plan does
  not suppress it.
- **Deterioration never increases demand.** Stated again because it is the rule
  most likely to be quietly broken by a later well-meaning change.
- **The safety plan surfaces inside the plan**, not only at crisis level — a
  hard week within a plan is exactly when someone's own coping steps are worth
  showing.
- **Stopping is a first-class action.** One tap, no confirmation friction, no
  "are you sure you want to give up".
- **Consent-gated end to end.** A plan is entirely built from mood data, so it
  requires mood-tracking consent and is swept by the erasure guard like
  everything else.
- **No clinical language anywhere.** Reviewed as copy, not just as code.

---

## 9. What it costs to build

| Phase | Work | Size |
|---|---|---|
| **1 — Skeleton** | `ListeningPlan` + `PlanStep` models, erasure sweep, enrolment with a derived target, step generation from persona timing, plan/step read endpoints | Medium |
| **2 — The loop** | Steps become real sessions, completion writes through to the existing outcome path, `PlanBehaviour` materialised nightly, progress screen separating adherence from effect | Medium |
| **3 — Adaptation** | The five rules, the adaptation log, plain-language change notices, replay harness to test a rule change against history | Medium |
| **4 — Voice** | Agent tools, verifier-backed progress explanations, one daily notification on the existing delivery-receipt substrate | Small |
| **5 — The read-out** | End-of-plan summary, graduate/extend/repeat, export | Small |

Roughly two to three weeks of focused work, and **no new dependencies** — it is
composition of things that already exist.

---

## 10. Honest risks

**Sample size, again.** A 14-day plan yields ~10 measured sessions. That is not
enough to say a plan worked; it is enough to say what *happened*. The read-out
must use the same `provisional` vocabulary as everything else, and the
deterioration rule must be tuned to avoid firing on noise — 4 samples and a 0.8
drop is deliberately conservative.

**Adherence is not the goal, and it will be tempting to optimise it.** A plan
with 100% adherence and no measured movement is a failure the metrics would
call a success. Report both, always, side by side.

**Regression to the mean cuts both ways here.** People enrol when they feel bad,
so *any* plan will look like it worked. The baseline machinery already built is
what stops this being a lie — a plan's claimed effect must be measured against
`BaselineCell`, not against the enrolment low point.

**Plans invite clinical reading regardless of copy.** Someone will describe this
to a friend as "the app gave me a programme for my anxiety". The disclaimers,
the naming, and the refusal to diagnose are the mitigations, and they need to
hold in every surface including notifications.

---

## 11. Why this is the right next feature

Everything built so far measures. Nothing yet *guides*. A user today can
discover what works for them by accident; a plan is the difference between a
tool and something that takes you somewhere.

And it is the feature that makes the rest legible. The control arm, the lift
estimator, the bandit, the persona, the verifier — each is defensible on its
own but abstract. A plan is where a person can see all of it working on their
behalf, and it is the answer to the only question that really matters about
this project: *what is it actually for?*
