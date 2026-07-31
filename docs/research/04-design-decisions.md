# Design decisions — from research to mechanics

**Status: IMPLEMENTED** (except where noted under "Proposed changes" below).
The gap/distribution maths lives in `src/renderer/gap.js`, unit-tested in
`src/renderer/gap.test.js`.

This is the synthesis of [`01`](01-hydration-timing-evidence.md), [`02`](02-ux-patterns-run1.md)
and [`03`](03-ux-patterns-run2.md) into a concrete set of changes, with the
provenance of every number attached.

---

## The problem with the current model

`src/renderer/pace.js` ramps "expected" intake linearly from wake to bedtime
(derived from quiet hours; fallback 08:00–22:00) and reports **debt** as the
shortfall of the cumulative total against that ramp.

It is not wrong. It is **blind to distribution**, structurally — it compares one
cumulative number against another. 800 ml chugged at noon and 200 ml × 4 spread
across the morning produce an identical input, so no pace model built on
cumulative totals can ever tell them apart. The defect the user described
(chug, then eight dry hours) is invisible to it by construction.

## Why a long rolling window does not fix it

The originally proposed fix — "how much have I drunk in the last 8–12 hours" —
makes the problem *worse*, not better. Worked example: drink 800 ml at 12:00,
nothing after.

| Clock | Trailing 12h | Trailing 2h | Time since last |
|---|---|---|---|
| 12:30 | 800 ml | 800 ml | 30m |
| 15:00 | 800 ml | **0 ml** | 3h |
| 18:00 | 800 ml | **0 ml** | 6h |
| 19:59 | 800 ml | **0 ml** | 8h |

A 12-hour window reads a flat, healthy 800 ml through the entire dry spell. **A
long window smooths, and smoothing is the exact opposite of detecting
roughness.** The longer the window, the closer it gets to being the daily total
it was meant to improve on.

Two independent lines of reasoning converge here: the physiology scan found the
only experimentally anchored window is **~2 hours** (water absorption completes
at 75–120 min), and the UX scan independently observed that a window total
"can't distinguish steady sipping from one chug 30 minutes ago."

**Decision: do not build a user-selectable 6h/8h/12h window.** It is a knob that
degrades the metric in every position.

## What to measure instead

The signal is the **gap**, not the window total. Supporting reasoning:

- Physiologically, spread beats bolus for retention (~20 percentage points,
  two RCTs) — so time-between-drinks is the behaviour that matters.
- The medication-adherence literature found timing *variability* predicted
  future missed doses at AROC 0.79 — i.e. **the gap is a leading indicator and
  the cumulative total is a lagging one.**
- A gap is computable exactly from timestamps already stored. No model, no
  invented constant, nothing for a user to argue with.

---

## Numbers, and where they come from

| Parameter | Value | Basis |
|---|---|---|
| Per-drink soft cap | 500 ml | Direction **evidence-based** (Maughan 2016: 1 L in 30 min → 1337 ml urine over 4 h). Exact figure **extrapolated** — no study titrated it. |
| Safety ceiling | 800 ml/hour | **Evidence-based.** Max renal free-water excretion ~735–970 ml/h. |
| Hour-cell saturation | 250 ml | **Design invention.** Chosen so a normal glass fills a cell and chugging cannot brighten it further. |
| Max waking gap | 3 hours | **Extrapolation. No study tests this.** Must not be presented in-app as medically established. |
| Rolling window (if used) | 2 hours | **Reasonable extrapolation** from absorption kinetics (Péronnet 2012; BHI measured at 2 h). |
| Drinking occasions/day | 5–8 | **Arithmetic**, not an optimum: EFSA 2.0–2.5 L ÷ 500 ml cap. |
| Overnight gap | Not penalised | **Evidence-based.** First-morning urine is most concentrated by design (Perrier 2013). |

---

## Cross-cutting design rules

These bind regardless of which visual is chosen. They come from the guilt /
tracking-anxiety findings in [`02` §4](02-ux-patterns-run1.md#4-design-critique-known-failure-modes).

1. **No score.** Raw millilitres and raw durations only. No percentage, no
   letter grade, no "hydration score". A percentage is a grade, and every
   finding in the guilt literature attaches to grades.
2. **Colour only the present.** A gap that already happened is history with no
   available action; colouring it is a verdict. Only the *live* gap warms
   toward amber. Colour then always means "you could drink now", never "you
   failed then".
3. **Warm/cool, not green/red.** CGM earned its red clinically; a water tracker
   has not. Cyan for logged, slate for empty, amber only for the live gap.
4. **Cap the guilt counter.** Display `4h+` rather than letting "time since last
   drink" climb to `9h 40m`. The animation budget goes on the cell lighting up
   when you log, not on the number ticking while you don't.
5. **Cap the chug reward.** An hour cell must not get brighter past 250 ml, so
   distribution — not volume — is what makes the strip look good. This is the
   single most important mechanic decision: it encodes Jones 2010 directly into
   the visual grammar rather than explaining it in copy.
6. **Don't claim health outcomes.** No study has shown that even distribution
   improves any health outcome at matched daily volume. The defensible claim is
   retention ("spread out, you keep more of it") and subjective symptoms
   ("you'll feel worse" — dry mouth, mood, fatigue). Explicitly **not**:
   kidney protection, headache prevention, or cognitive performance.

---

## What was built

| Change | Where | Status |
|---|---|---|
| Reminder anchored to the **last actual drink**, surviving an app restart | `reminders.js` (`anchorToLastDrink`, `reanchor()`), `main.js` (`getLastDrinkMs`) | done |
| "Time since last drink", capped at `4h+` | `gap.js` `formatGap` / `gapLevel` | done |
| "Longest quiet stretch today", silent when unremarkable | `gap.js` `longestGapMs` / `longestGapNote` | done |
| 24-cell hour strip replacing the Pace chart | `index.html`, `renderer.js` `renderRhythm`, `styles.css` | done |
| 250 ml saturation cap on cell brightness | `gap.js` `cellFill` | done |
| Trailing-60-min intake rail at 800 ml | `gap.js` `trailingMl` / `intakeNote` | done |
| Sleep never scored; overnight gap not penalised | `gap.js` `longestGapMs` | done |
| "Typical day" percentile bands in History | — | deferred (needs ~14 days of data) |

### Two deviations from the original plan, and why

1. **Reminders were already gap-anchored.** `main.js` called
   `scheduler.noteActivity()` on every log, so the nudge already counted from
   your last drink rather than from a fixed clock. The real defect was narrower:
   the anchor lived only in memory and `start()` reset it to *now*, so
   relaunching the app forgave a gap in progress. That is what got fixed, plus
   a `reanchor()` so changing the reminder interval no longer wipes the gap.
   An already-overdue gap is pulled forward only as far as `startGraceMs`, so
   opening the app never fires a notification instantly.

2. **The per-drink 500 ml note was folded into the hourly rail.** The app's
   default bottle is 700 ml, so a note at 500 ml would have fired on the
   primary button every single time — precisely the nagging the design rules
   forbid. One rail at 800 ml over a trailing hour covers both concerns: it is
   the evidence-based number (renal free-water excretion), it stays quiet for a
   single bottle, and it still catches a genuine bolus (bottle + glass together).
   `intakeNote` has an explicit regression test that 700 ml returns `''`.

### Note on "active hours stop computing anything"

Only partly true, and worth being honest about. Quiet hours now (a) mute
notifications, as before, and (b) mark sleep un-scored in the gap maths, which
is new. They are **no longer the primary signal**. But the demoted pace/debt
line still uses the waking window as its denominator — a linear ramp needs one.
Removing it entirely would mean dropping the "will I hit my goal today" answer,
which was not the intent.

## Rejected

| Rejected | Why |
|---|---|
| 6h/8h/12h window selector | Smooths away the signal it is meant to detect (see table above). |
| Coverage ring ("6/8 hours covered") | Blind to volume — 100 ml × 8 = a perfect ring at 800 ml/day. Correctness bug, not taste. Plus rings carry the heaviest guilt baggage in consumer health UI. |
| Decay curve / "water on board" | The prettiest option and the only one that shows distribution as *shape*, but the half-life would be fabricated — there is no hydration equivalent of caffeine pharmacokinetics to cite. Revisit only behind a toggle, clearly labelled as a model. |
| Sip/event counting (SipFlow-style) | Trivially gamed: five 10 ml sips reads as excellent. Also discards volume data we already have. |
| Dual-axis hour bars + rolling line | Two unlabelled y-scales in a 380 px panel is illegible to anyone but its author. |
| Radial 24 h "sip clock" | Radial encoding misrepresents magnitude; costs ~120 px to say less than a 28 px strip. |

---

## Open question

The one thing research cannot settle: **when you go dry for eight hours, is it
the silence you want flagged, or the volume?** Everything above assumes the
silence. If that is wrong, the design changes.
