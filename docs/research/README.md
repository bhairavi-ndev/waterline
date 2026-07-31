# Research — the evidence basis for Waterline's mechanics

This folder is the written record of the research behind Waterline's hydration
model. It exists so that any number in the app — a window length, a gap
threshold, a per-drink cap — can be traced back to a source, or honestly
labelled as a judgement call when no source exists.

**If you change a threshold in the code, update the reasoning here too.**

## Contents

| File | What it is |
|---|---|
| [`01-hydration-timing-evidence.md`](01-hydration-timing-evidence.md) | Physiology literature scan. Bolus vs. spread intake, dehydration time-course, symptoms, vasopressin/copeptin, existing metrics. |
| [`02-ux-patterns-run1.md`](02-ux-patterns-run1.md) | UX/visualisation survey, first pass. Competitor landscape, cross-domain patterns, guilt/anxiety failure modes, six candidate visualisations. |
| [`03-ux-patterns-run2.md`](03-ux-patterns-run2.md) | UX/visualisation survey, second pass. Same brief re-run; reaches a **different** recommendation. Kept deliberately — see below. |
| [`04-design-decisions.md`](04-design-decisions.md) | The synthesis. What we decided, what we rejected, and which numbers are evidence-based vs. invented. **Start here.** |

## Why two UX reports that disagree

`02` and `03` are two runs of the same brief. They surveyed the same products,
found the same evidence, and then recommended **different** primary
visualisations — run 1 picked a "gap ledger", run 2 picked an hour strip and
explicitly called the gap ledger confusing.

Both are kept, unedited. The disagreement is itself a finding: the *substance*
(score the gap, not the daily total) was stable across runs, but the *visual
form* was not. That tells us the choice of chart is underdetermined by the
evidence and is a taste decision, not a research conclusion. Recording only the
winner would have hidden that.

## Verification status — read before citing any of this

This research was gathered by AI agents performing live web searches. Treat the
citations with proportionate scepticism:

- **Independently verified.** Jones et al. 2010 — fetched and checked directly
  against PubMed. Title, authors, journal, design, and all four numbers
  (700 vs 420 ml urine; 55% vs 75% efficiency; p = .018) match as reported.
  This is the single load-bearing citation for the whole feature, which is why
  it was checked.
- **Marked † in `01`.** Abstract or full text was fetched by the agent.
  Reasonably trustworthy.
- **Marked ‡ in `01`.** Search-index snippets only; the page itself was
  paywalled or blocked. Treat the numbers as one step less verified.
- **Everything in `02` and `03`.** Not independently verified. The competitor
  descriptions are low-stakes. The "compassionate design" sources in particular
  (two Smashing Magazine articles dated 2026, an arXiv preprint numbered
  2601.x) have **not** been confirmed to exist.

Nothing here was written from model memory — both agents were instructed to
cite only what they actually fetched, and to mark sections `NOT RESEARCHED`
rather than fill them in from recall.

## The one-paragraph summary

Drinking the same daily volume in one gulp versus spread across the day is
**not** equivalent: two independent RCTs found ~20 percentage points more fluid
retained when metered rather than bolused, because a rapid plasma dilution
suppresses vasopressin and you excrete the surplus. That justifies scoring
*distribution*, not just the daily total. But the supporting literature is small
(n = 8–10), young, fit, and exercise-dehydrated, and **no study has ever shown
that even distribution improves a health outcome at matched daily volume**. So
the app should surface distribution as useful information — not as a health
claim, and not as a grade.

## Provenance

Generated 31 July 2026 by two parallel research agents (Claude Opus 5), ~16–19
minutes each, 53 and 29 tool calls respectively. Original briefs are recorded at
the top of each report.
