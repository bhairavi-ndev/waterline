# Rolling-Window Hydration: UX Research + Design Proposals (run 2)

> **Provenance.** Same agent and same brief as [`02-ux-patterns-run1.md`](02-ux-patterns-run1.md),
> re-run after a "wrap up" nudge. 29 tool calls, ~19 min.
>
> **Why this exists.** This run reached a **different recommendation** from run 1
> on the same evidence: run 1 picked the "gap ledger" as the hero visual, run 2
> picks an hour strip and calls the gap-ledger form confusing on first encounter.
> The disagreement is preserved deliberately — it tells us the visual choice is
> underdetermined by evidence and is a taste call. The *substance* (score the
> gap, not the daily total) was stable across both runs.
>
> Citations here are **not** independently verified.

---

## 1. What existing hydration apps do

**Headline finding: almost nobody scores distribution. One app does, and it's tiny.**

### SipFlow — the direct precedent

SipFlow (iOS) is the only mainstream-ish hydration app I found that scores *recency* rather than daily total. Its mechanic:

- A **"flow state"** derived from sips in the **trailing 1 hour**: "Time for Water" (no sips in the last hour) → "Light Flow" (1-2 sips) → "Good Flow" (3-4) → "Strong Flow" (5+).
- A **24-hour grid**, one cell per hour: "Blue means you drank. Gray means you didn't." Current hour is highlighted.
- Explicitly framed around gaps: the design "emphasizes simplicity — showing exactly when hydration occurred versus when gaps happened."
- Also has "customizable active hours" — so it keeps your existing concept *and* layers recency on top.

Source: https://apps.apple.com/cl/app/sipflow/id6758342451

This is essentially proposal A in section 5, already shipped. That's a validation signal, not a reason to avoid it — it's an obscure app and the pattern is under-exploited.

### P App

Sends reminders based on **time since last logged event** rather than a fixed timer — "reminders are tied to your body pattern rather than only a fixed timer." (It's a bathroom-tracking app, but the scheduling logic is the same shape.)
Source: https://pwaterapp.com/

### WaterMinder — daily totals + streaks, no intraday

WaterMinder's analytics (v7.4) are **cross-day distribution, not intraday distribution**:

- "Goal Achievement Distribution Analytics — See how often your hydration falls within different goal completion ranges over time"
- "Critical Low Hydration Detection — Track days where hydration intake falls below critical thresholds"
- "Average Water Intake Insight"
- "AI Gulp Detection" (audio-based sip estimation — a *logging* feature, not a scoring one)

No hourly breakdown, no time-since-last-drink, no gap detection.
Sources: https://apps.apple.com/us/app/waterminder-water-tracker/id653031147, https://waterminder.com/

### Hydro Coach

Stats are: streaks, weekly performance, lifetime total, a 2-week hydration-level graph, most-used drink sizes, day-of-week performance. Pro adds monthly stats. **Day-granularity only.**
Sources: https://hydrocoach.com/, https://play.google.com/store/apps/details?id=com.codium.hydrocoach.pro

### Waterllama

Gray llama fills with liquid as you log; 150+ beverages with hydration coefficients; "intelligent reminders tailored to the user's daily schedule"; Apple Design Award 2022 finalist. The reminder scheduling is adaptive, but the **displayed metric is a daily fill level** — the llama doesn't drain.
Sources: https://waterllama.com/, https://apps.apple.com/us/app/water-tracker-waterllama/id1454778585

### Plant Nanny

Virtual plant that grows/wilts. This is a *gap* mechanic in disguise — the plant is a decaying-state proxy — but it's day-granular and punitive by construction (your plant dies).
Source: https://play.google.com/store/apps/details?id=com.fourdesire.plantnanny2

### Ulla (hardware) — the purest "time since last drink" product

A puck that straps to any bottle and **blinks when you haven't picked the bottle up in 30-40 minutes**. The timer resets on detected pickup. No totals, no goals, no app — the entire product *is* the gap metric. Notably it uses **blinking light, no sound** ("no disturbing noises"), and has proximity/daylight sensors so it stays quiet when you're not there.
Sources: https://www.amazon.com/Ulla-Smart-Hydration-Reminder-Black/dp/B017NK0A6I, https://www.zoopy.com/ulla-review/

### HidrateSpark

Per-sip Bluetooth logging ("SipSense"), bottle glows to remind, goal adjusted by activity/weather, reminder interval configurable **from 15 minutes to 10 hours**. Two-way Apple Health sync. Scoring is still daily-goal-based; the glow is a fixed-interval reminder, not a computed gap score.
Sources: https://hidratespark.com/, https://apps.apple.com/us/app/hidratespark-water-tracker/id1056269374

### Apple Health / Health Connect

Not directly verified in this pass beyond confirming multiple apps do two-way water sync. I found no evidence of a built-in rolling-window or gap metric for water in either platform — treat as "not verified" rather than "confirmed absent."

**Summary of the landscape:** the category is stuck on `sum(today) / goal`, plus a day-granular streak. SipFlow and Ulla are the two products that treat *time since last intake* as the primary signal. Nobody I found offers a user-selectable 6h/8h/12h rolling window.

---

### Bonus: the physiology backs the insight

Jones, Bishop, Green & Richardson, *Int J Sport Nutr Exerc Metab*, April 2010 — "Effects of metered versus bolus water consumption on urine production and rehydration." Eight subjects dehydrated 2% body weight, then rehydrated with an identical total volume via either **bolus** (100% in 1 hour) or **metered** (12.5% every 30 min over 4 hours).

- Mean urine output: **420 ml metered vs 700 ml bolus**
- Hydration efficiency: **75% metered vs 55% bolus** (p = .018)

Conclusion quote: *"These findings suggest that rehydration rate is a factor in fluid-balance response."*

Source: https://pubmed.ncbi.nlm.nih.gov/20479487/

Same total volume, ~20 percentage points more retained. A daily-total metric is measuring the wrong thing, and there's a citation for that.

Related: the Beverage Hydration Index literature (Maughan et al., *AJCN* 2016) formalizes that *what* you drink changes retention — a useful precedent for the idea that "ml logged" is a crude proxy for "ml retained."
Source: https://ajcn.nutrition.org/article/S0002-9165(22)06556-X/fulltext

---

## 2. Rolling-window / recency-weighted patterns in other domains

### Caffeine half-life apps — the closest formal analogue

**HalfCup** (iOS): a **visual decay curve** showing caffeine level dropping in real time, with a **scrubbable timeline** to check your level at any future time. User-adjustable half-life (2-10h) and a 30-minute absorption ramp.
Source: https://apps.apple.com/py/app/caffeine-tracker-halfcup/id6756392479

The whole genre uses `C(t) = C0 * 0.5^(t / half_life)`, plots a curve with a visible peak, and answers one forward-looking question: *"when am I clear to sleep?"*
Sources: https://tool.teamzlab.com/coffee/caffeine-half-life-calculator/, https://miniwebtool.com/caffeine-half-life-tracker/, https://caffeinemath.com/home/

**What transfers:** the *shape*. Each log is an impulse; the display is the sum of decaying impulses; the curve slopes down when you do nothing, which makes doing nothing legible without a notification. Hydration is arguably a better fit than caffeine because water genuinely does leave (see the Jones study above).

**What doesn't transfer:** caffeine apps are about *avoiding* a threshold at a known future time. Hydration has no equivalent bedtime deadline, so the "scrub to the future" affordance loses its payoff.

### Sleep debt — RISE

RISE computes sleep debt over a **14-night rolling window** and surfaces it as **one number**. Critically, the algorithm is **recency-weighted: ~15% of the weight is on last night**, "as this is the night that makes the biggest difference to how you feel today." Their stated design rationale is that the long window "takes the pressure off each single night."
Sources: https://www.risescience.com/blog/best-sleep-debt-tracking-app, https://www.risescience.com/blog/whoop-vs-rise-sleep-app

**What transfers:** this is the single best design precedent for your problem. A window long enough that one bad hour doesn't nuke the score, plus explicit extra weight on the most recent slot so the number still responds to *now*. It's the exact tension you're navigating between "daily total" (too forgiving) and "did you drink this hour" (too twitchy).

Oura and Sleep Cycle don't track sleep debt at all; Whoop, AutoSleep and Sleepzy do but against generic or self-set targets (per RISE's own comparison, so read with bias).

### CGM — Time in Range / Ambulatory Glucose Profile

The AGP is a standardized single-page report, developed by the International Diabetes Center and adopted across CGM vendors, built on a **14-day composite**. Three components matter here:

1. **The TIR stacked bar** — a single vertical stacked bar, color-coded: green = in range, yellow/orange = above, red/dark red = below. One bar answers "what proportion of my time was good."
2. **The AGP curve** — all readings from the period collapsed onto **one 24-hour x-axis**, drawn as a median line with percentile bands (typically 5/25/75/95). This shows *habitual time-of-day patterns* — "you always crash at 3pm" — which a daily total can never show.
3. **Daily thumbnails** — a grid of small 24h sparklines, one per day.

Sources: https://diabetesjournals.org/care/article/42/8/1593/36184/Clinical-Targets-for-Continuous-Glucose-Monitoring, https://www.novomedlink.com/diabetes/hcp-education/clinical/time-in-range/clinical-use/understand-ambulatory-glucose-profile.html, https://diatribe.org/diabetes-technology/making-most-cgm-uncover-magic-your-ambulatory-glucose-profile

**What transfers:** the percentile-band-over-24h idea is superb for a "your typical day" panel. Also the discipline of TIR: it's a *percentage of time*, not a total, which is exactly the reframe you want.

**Caution:** CGM's color language (red = dangerous) is clinically earned. Copying it for water is exactly the "red = failure" trap in section 4.

### Medication adherence — the strongest argument for scoring gaps

The most useful paper I found: *"Novel Approaches for Visualizing and Analyzing Dose-Timing Data from Electronic Drug Monitors, or 'How the Broken Window Theory Pertains to ART Adherence.'"*

Their argument, nearly verbatim your insight: reporting only the proportion of doses taken *"may overly simplify a complex set of behaviors into a single, de-nuanced, summary metric."*

They propose scatter plots of dose time vs. calendar date in two framings — **uni-modal** (date on Y, absolute hours-from-prescribed on X, good for slope/drift patterns) and **bi-modal** (date on X, signed early/late on Y, separates early from late behavior).

Key result: **timing *variability* (RMSE) predicted future missed doses with AROC 0.79, and each quartile increment roughly doubled the odds of outright missing doses.** Irregular timing is a leading indicator of failure that the aggregate percentage hides entirely.

Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC4938894/, https://pubmed.ncbi.nlm.nih.gov/25893658/

The broader adherence-viz literature converges on: **heat maps for pattern-at-a-glance, longitudinal bar/line graphs for exact values**, with explicit encodings for gaps in continuity.
Sources: https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0174426, https://wiki.cs.umd.edu/cmsc734_s15/index.php/PILLS:_Interactive_Visualization_for_Medication_Adherence_Exploration

### Compact-form guidance

Horizon charts compress trends across many categories into layered bands — strong when you have *many* series, which you don't. Sparklines are the standard "trend shape in one cell, no axes" form. The Stripe-style card (big number + delta + sparkline) is the durable pattern for a compact panel.
Sources: https://observablehq.com/blog/big-insights-small-spaces, https://en.wikipedia.org/wiki/Sparkline, https://en.wikipedia.org/wiki/Horizon_chart

**My read: horizon charts are wrong for you.** They exist to solve many-series-in-little-vertical-space. You have one series. They'd cost you legibility for nothing.

---

## 3. Streak / gap visualization

### GitHub contribution graph — the canonical form, and the canonical cautionary tale

The 52×7 cell grid is the reference implementation of "gaps as absence of ink." It works because *the eye finds runs of blank cells without being told to*.

But the criticism is severe and directly relevant:

- Scott Hanselman's "GitHub Activity Guilt and the Coder's FitBit" — explicitly frames the graph as a fitness tracker for developers, and argues it disadvantages people without discretionary time, favoring "the already skilled vs. the codenewbie" and those with "more spare time, e.g. young, single."
- The best line, from his comments, on a developer who broke a 129-day streak: **"I lost sight of my actual goal of learning more stuff… the proxy-goal became the actual goal."**
- Gaps read as moral failure: sparse graphs "feel like failure"; juniors run midnight commits to keep squares green; the graph is trivially gamed with a cron job.

Sources: https://www.hanselman.com/blog/github-activity-guilt-and-the-coders-fitbit, https://dev.to/sylwia-lask/your-github-contribution-graph-means-absolutely-nothing-and-heres-why-2kjc, https://medium.com/@automate.x.a2b/i-hacked-githubs-contribution-graph-here-s-how-embarrassingly-simple-it-was-0246e9e94abb

### Streaks / Streakly / Habitica / heatmap trackers

- **Streaks** (Apple Design Award): every task is a streak; **missing a day resets to zero**. Maximally punitive.
- **Streakly**, **Habit Heatmap**, **HabitHeat**: calendar heatmap, one square per day — "see when they showed up, where they had gaps, and how consistency changed."
- **Habitica**: RPG framing — your character *takes damage and recovers*, rather than a binary reset. A genuinely different failure model.
- **HabitBrix**, **Duolingo**: "streak freeze" — miss a day without losing progress.
- **Way of Life, Habit Doom, Done**: documented as handling missed days more gently than the reset-to-zero default.

Sources: https://habi.app/insights/best-streak-tracker-apps/, https://habitheat.com/heatmap-habit-tracker/, https://apps.apple.com/us/app/-/id1637037683, https://duoplanet.com/duolingo-streak-freeze/

**What reads well for "you went 7 hours without":** the evidence points to *contiguous blank run length* as the encoding — not a counter, not a color. A run of empty cells is preattentive; "7h" as a number requires reading. The GitHub grid gets this right even as its social framing gets everything else wrong.

---

## 4. Design critique — known failure modes

### The guilt loop is well documented

- Performance-centered features — **streaks, competition, normative targets** — "can evoke guilt, anxiety, or perceived failure when users fall short of goals." What presents as motivation "can quickly transform into a source of performance pressure and guilt."
- For users with depression, "a broken streak or a missed daily goal can exacerbate the very feelings the app aims to alleviate."
Sources: https://www.smashingmagazine.com/2026/07/designing-distressed-users-mental-health-apps-ui/, https://www.smashingmagazine.com/2026/02/building-empathy-centred-ux-framework-mental-health-apps/, https://arxiv.org/pdf/2601.14589

> ⚠️ These three sources have **not** been independently verified and may not exist.

### Tracking-anxiety / disordered-use literature exists

- "For some users, self-tracking becomes a source of anxiety, rigidity, and self-judgment"; quantifying intake "can trigger behaviors associated with eating disorders."
- Orthorexia's defining feature — "difficulty deviating from food rules, often accompanied by guilt, anxiety, or shame" — is precisely what a rigid hourly hydration target could manufacture. **A metric that says "you must drink every hour" is a food rule.** Take this seriously; hydration apps are adjacent to intake tracking.
Sources: https://www.allianceforeatingdisorders.com/health-tracking-apps-and-disordered-eating/, https://lifestance.com/blog/orthorexia/

### The Apple Watch rings problem — the closest cautionary UI

Users report their days "revolving around those numbers entirely," whether or not they "closed their rings"; one widely-quoted Reddit post: *"I feel ashamed but I've been taking a walk at 11:30 p.m. just to complete my ring before midnight."* Risk is documented as concentrated in "perfectionist tendencies or a history of eating disorders or anxiety."
Sources: https://www.yahoo.com/lifestyle/people-ditching-apple-watches-feeling-170502940.html, https://www.michigandaily.com/opinion/you-dont-have-to-close-your-rings/

**The direct analogy:** a rolling-window score creates a "close your ring before midnight" moment *every hour instead of once a day*. That's a 16× increase in guilt surface area. This is the single biggest risk in the feature.

### Metric gaming

The GitHub case is the proof: a 5-minute cron job fakes the graph. For hydration, the gaming move is obvious — **log 100 ml every hour without drinking it**, or split one real 800 ml chug into eight fake 100 ml logs. Your rolling window is *more* gameable than a daily total, because it rewards log *events* rather than volume. Design accordingly.

### Notification fatigue is not a hypothetical

- Clinicians override **49-96%** of clinical decision-support alerts. Alert fatigue is the best-studied version of this failure.
- "The same app sending the same notification at the same time every day becomes invisible within a week."
- JITAI (just-in-time adaptive intervention) research exists precisely to fix this: deliver support "when the person is most in need and receptive," adapting continuously to "minimize user burden and habituation."
Sources: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5729261/, https://link.springer.com/article/10.1186/s12912-026-04592-1, https://humanfactors.jmir.org/2025/1/e66750

Note the Ulla precedent here: **silent blinking light, proximity-gated, no sound at all.** A hardware product that solved notification fatigue by refusing to make noise.

### Persuasive-design ethics

Eyal himself distinguishes persuasion (helping people do what they already want) from coercion, and proposes a **"regret test"** — would the user regret this if they knew how it worked? Critics argue the "if the objective is good then manipulation is fine" position is naïve, and that dark patterns descend directly from Fogg/Eyal-style choice architecture.
Sources: https://journalismdesign.com/nir-eyal-persuasive-technology-good-bad-habits/, https://axbom.com/nir-eyal-habit-danger/, https://suebehaviouraldesign.com/why-nir-eyal-is-a-bit-of-a-hypocrite/

The regret test is a usable ship-gate for this feature: *would a user, understanding exactly how the rolling window scores them, be glad it nudged them — or feel manipulated?*

### The compassionate alternative, concretely

Duolingo's articulated principle: **"design humane pressure" — commitment devices plus forgiveness (freezes, repairs) so a bad day doesn't nuke months of progress.** Stated corollaries: don't guilt over missed days, don't catastrophize the loss, **celebrate the return.** Habitica's damage-and-recovery model is a second variant. Some critics go further and argue for structurally granted rest days rather than earned freezes.
Sources: https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/, https://designbuddy.substack.com/p/is-duolingo-unethical

---

## 5. Concrete visual vocabulary — design proposals

*Everything below is my own design work, not a description of existing products, except where I note the precedent. Target: ~380px wide, dark theme, Electron.*

Assume a shared substrate: `logs = [{t, ml}]`, and a derived per-hour array `hourly[24]`.

---

### A. The Hour Strip (24 cells, trailing window outlined)

**What it looks like.** A single horizontal row of 24 rounded-rect cells spanning the full 380px — each cell ~13px wide, ~28px tall, 2px gap. Cell fill = a blue whose *opacity* maps to ml logged in that hour, on a compressed scale (0 ml → 6% opacity "empty slot" tint; 250 ml → 100%). Above 250 ml the cell does **not** get brighter; it gets a thin bright top-edge cap. That's deliberate — it removes the reward for chugging.

The trailing N hours are enclosed in a 1px rounded stroke in a neutral bright color, floating *outside* the cells, with the window's total in ml sitting immediately right of the stroke at the same baseline. The current hour has a 2px bottom underline. Hours in the future are drawn as bare 1px dotted outlines, no fill.

Below the strip, three tick labels only: 6, 12, 18.

**What it encodes.** Volume per hour (opacity), position in day (x), current moment (underline), the rolling window (the outline), and gaps (runs of near-empty cells) — all at once.

**Good at.** Gaps are preattentive: a 7-hour dry spell is a visually obvious dark band, and you read its *length* without counting. The window outline makes the rolling concept literal — you can watch it slide. Extremely compact. Scales to any N without a redesign. Trivial to implement (24 divs).

**Fails at.** Opacity is a weak quantitative channel — you cannot compare 180 ml vs 240 ml. Hour-boundary artifacts: drinking at 10:59 and 11:01 looks like two hours of coverage, drinking twice at 11:15 and 11:45 looks like one. Low-opacity cells on a dark background can fall below contrast thresholds. 13px cells are near the floor for hover targets.

**Precedent.** SipFlow ships a binary version of this (blue/gray, no opacity ramp, no window outline). The opacity ramp, the cap, and the sliding window frame are my additions.

---

### B. The Decay Curve ("what's still in you")

**What it looks like.** A filled area chart, ~380×80px, x = last 12 hours → now, pinned to the right edge. The y value is a decaying accumulation: each log adds its ml, and the whole stock decays with a fixed half-life (start at ~90 min, exposed in settings the way HalfCup exposes caffeine half-life). The result is a sawtooth — sharp rise on each log, exponential slump between.

Fill is a vertical gradient from a mid-blue at the curve down to near-transparent at the baseline. The curve itself is 1.5px, brighter. At the right edge, a 4px dot at the current value, and to its right the current level as a large number. Past the right edge, a **dotted continuation** projecting the next 2 hours of decay if you drink nothing — this is the whole point of the chart.

No y-axis. One faint horizontal dashed line at the "comfortable" level.

**What it encodes.** A physiologically-flavored stock rather than a flow. Recency-weighting is *implicit in the geometry* — no explanation needed.

**Good at.** Uniquely, it makes the 800ml-chug pattern **look wrong**: a huge spike followed by a long slide to the floor is visibly worse than a gentle sawtooth riding mid-height, even though the areas are comparable. That's exactly the intuition the user wants to install. The dotted projection creates forward-looking motivation without a notification. It's beautiful, and it makes the app feel like it models you rather than counts you.

**Fails at.** The half-life is *fabricated*. Water pharmacokinetics aren't a clean exponential and the Jones study measures retention efficiency, not a decay constant — if you ship this you are shipping a metaphor wearing a lab coat, and a skeptical user will call it out. Rewards frequent small logs strongly, so it's the most gameable option. Reading an exact value is impossible. And the curve slumping toward zero all evening is a guilt engine — the "your tank is draining" framing is one CSS color away from feeling like a health scare.

**Precedent.** Structurally identical to HalfCup's caffeine curve, including the scrubbable-future idea.

---

### C. Window Gauge + Gap Counter (the two-number card)

**What it looks like.** A horizontal card, no chart. Left two-thirds: a big number, `640 ml`, with a small caption underneath, `last 8 hours`, where "8 hours" is a subtle inline dropdown (6 / 8 / 12). Directly under the number, a 4px-tall progress bar showing that volume against the pro-rated target for that window — but the bar is **not** red when short; it's simply less full, in a single hue, with the remainder at 8% opacity.

Right third, separated by a hairline: a smaller number, `2h 10m`, caption `since last drink`. Beneath it, a second line in a dimmer weight: `longest gap today 4h 30m`.

Whole card is ~380×88px.

**What it encodes.** The two numbers the user actually described, and nothing else.

**Good at.** Zero learning curve. Precise — the failure mode of every graphical option here. Fits a compact window trivially, works at any size, screen-reader friendly by construction. Ships in an afternoon. It's the honest baseline that every other proposal has to beat.

**Fails at.** No shape, no pattern, no memory. Can't distinguish "steady sipping" from "one chug 30 minutes ago" — both can show 640 ml / 8 h. Doesn't teach the insight, only reports the consequence. "Time since last drink" ticking upward is a low-grade anxiety generator if it's the most prominent thing on screen at 3pm.

---

### D. Coverage Ring (time-in-range for water)

**What it looks like.** A 96px donut, 10px stroke, in the left of a card with text to the right. The ring is divided into N arc segments — one per hour of the rolling window (8 segments for 8h). Each segment is fully lit if that hour had ≥ some floor (say 100 ml), dim if it had a trace, and near-black if it was dry. The ring reads clockwise with *now* at 12 o'clock and the oldest hour just counter-clockwise of it, so the ring rotates through the day.

Center of the ring: `6/8`. Text to the right: `hours covered`, then a second line `longest gap 3h`.

**What it encodes.** Proportion of *time* covered, not volume. This is CGM's Time-in-Range logic transplanted directly.

**Good at.** Directly measures distribution, which is the actual thing you're trying to score. Immune to the chug — 800 ml in one hour lights exactly one segment, so the ring stays mostly dark and the metric correctly says "bad." Reframes success from "amount" to "presence," which is a healthier target and is *harder to fail catastrophically*. Segmented arcs read cleanly at 96px in dark themes.

**Fails at.** Rings are the single most guilt-loaded shape in consumer health UI — see the Apple Watch findings in section 4. An incomplete circle *demands* closing in a way a partial bar doesn't. It also throws away volume entirely: 100 ml/hr × 8 lights the whole ring at 800 ml/day, which is dehydration with a perfect score. Needs a volume co-metric, which undoes the simplicity. And the binary threshold creates a cliff at 99 vs 101 ml.

---

### E. Gap Bar (the negative-space view)

**What it looks like.** Deliberately inverts the usual encoding. A single 380×20px horizontal track spanning your active window. **Drinks are thin bright 2px tick marks. The gaps between them are the drawn objects** — each gap rendered as a filled block whose color temperature ramps with duration: under 90 min = nearly invisible (5% white), 90 min-3h = a soft slate, 3h+ = a warm dim amber (not red). The longest gap of the day gets a small label centered inside it: `4h 20m`.

The block currently in progress — the gap you're in right now — has a soft animated shimmer on its right edge, growing in real time.

**What it encodes.** Only absence. Volume is not represented at all.

**Good at.** It is the *only* proposal here that makes the user's stated insight the literal subject of the graphic. The 8-hour dry spell isn't inferred from missing cells — it's a labeled object with a size. Excellent for a weekly review view, where seven stacked gap bars would show your recurring 2pm-6pm hole instantly. Rendering gaps as objects rather than voids also sidesteps GitHub's "sparse graph = shameful" read, because a mostly-empty bar here means *good*.

**Fails at.** Inverted polarity is genuinely confusing on first encounter — users expect ink to mean "did the thing." Useless as the only view, since it can't tell you how much you drank. The growing shimmer on the current gap is a live guilt meter; it will need a cap or it becomes hostile by 4pm. Amber is one hue-step from red and inherits some of red's failure semantics.

---

### F. Typical-Day Bands (the AGP transplant, for a history panel)

**What it looks like.** Not a today view — a *pattern* view. x-axis is 0-24h, one full day. Overlaid: your last 14 days of hourly intake collapsed into percentile bands — a filled 25th-75th percentile band in translucent blue, a 1.5px median line, and a fainter 10th-90th band behind. Today's actual line drawn on top in white, 1.5px, terminating at the current hour with a dot.

~380×110px. Two axis labels, no gridlines except a hairline at the median target.

**What it encodes.** Your habitual daily shape, and where today diverges from it.

**Good at.** Answers the question no other view here can: *"do I always go dry at the same time?"* If you have a 2pm-6pm hole every single day, this makes it a permanent visible feature of your life rather than a daily verdict. It's diagnostic rather than evaluative — it invites "huh, I should keep a glass at my desk" instead of "I failed." Directly lifted from a clinically validated report format.

**Fails at.** Needs 10+ days of data before it means anything — dead weight for new users. It is a *pattern* tool, not a nudge tool: it will never tell you to drink right now. Percentile bands are the most conceptually demanding thing on this list. And it costs the most pixels of any option here.

**Precedent.** This is the AGP curve from CGM reports, retargeted.

---

## Recommendation (run 2)

**Ship C + A together as one panel. Bet on the Hour Strip as the signature.**

**Why C (Window Gauge + Gap Counter) is the required floor.** Every graphical option above trades precision for shape, and a hydration app that can't tell you a number is a toy. C is also the only option that directly renders the two quantities the user named — "how much in the last N hours" and "time since last drink" — with no interpretive layer. It costs ~88px and an afternoon. Build it first; it de-risks everything else.

**Why A (Hour Strip) is the one to bet on.** It's the best ratio of insight to pixels on the list. Gaps become preattentive without inverting anyone's expectations, the sliding outline teaches the rolling-window concept visually so you never have to explain it, and unlike the ring it carries volume information. It survives the compact-window constraint at any N. And SipFlow having shipped a simpler version is evidence the form works, not a reason to avoid it — the opacity ramp, the anti-chug cap, and the window outline are all headroom they left on the table.

**Two design constraints I'd hold firmly, given section 4:**

1. **Cap the reward for volume-per-hour (the "cap" in proposal A).** If a cell can't get brighter past ~250 ml, chugging cannot buy you a better-looking strip. This kills the gaming vector and encodes the physiology from the Jones study directly into the visual grammar. This is the most important single decision in the feature.

2. **No red, and no counter that only goes up.** Dry hours should be *absence of light*, never a warning color — CGM earned its red, you haven't. And cap "time since last drink" display at something like `4h+` rather than letting it climb to `9h 40m`; per the Duolingo principle, the moment that matters is the return, so the strongest animation budget in the whole panel should go on the cell lighting up when you log, not on the guilt accumulating before you do.

**What I'd defer.** F (Typical-Day Bands) is genuinely valuable but belongs in a history/stats view, not the main panel, and needs two weeks of data first — build it second, not now. B (Decay Curve) is the prettiest and the most seductive, but the half-life is invented and it's the most gameable and most guilt-prone option; only build it if you're willing to defend the model. D (Coverage Ring) I'd skip outright — the ring shape carries too much Apple-Watch baggage for a metric explicitly designed to be non-punitive, and its blindness to volume is a real correctness bug, not just an aesthetic one.

**One framing note worth putting in the UI copy:** lead with the Jones 2010 finding (75% vs 55% hydration efficiency, same total volume). It converts the whole feature from "we changed the metric" into "the old metric was measuring the wrong thing, here's the study." That's a much better story, and it happens to be true.
