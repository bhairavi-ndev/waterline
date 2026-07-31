# Rolling-Window Hydration: UX Research + Design Proposals (run 1)

> **Provenance.** Research agent, 31 July 2026. 29 tool calls, ~16 min.
> **Brief:** UX/visualisation patterns for a desktop hydration tracker (Electron,
> dark theme, ~380px panel). The app currently scores against "active hours"; we
> are considering a rolling-window concept plus a "time since last drink" notion.
> Survey competitors, cross-domain rolling-window visualisations, gap
> visualisation, known failure modes, and propose concrete visual candidates.
>
> **Status:** superseded in its *recommendation* by [`03-ux-patterns-run2.md`](03-ux-patterns-run2.md),
> which re-ran the same brief and picked a different primary visual. Both kept.
> Citations here are **not** independently verified.

---

## 0. The finding that justifies the whole feature

Before the UX: the user's insight is **experimentally correct**, not just intuitive. Jones et al. (2010, *Int J Sport Nutr Exerc Metab*) dehydrated subjects 2% body weight, then rehydrated with the *same total volume* delivered two ways — bolus (100% in 1 hour) vs metered (12.5% every 30 min over 4 hours). Results: mean urine output 700 ml (bolus) vs 420 ml (metered); **hydration efficiency 55% vs 75%** (p = .018). ([PubMed 20479487](https://pubmed.ncbi.nlm.nih.gov/20479487/))

Same ml in, ~36% more retained when distributed. This is the single most useful citation for this feature — it means "chug 800 ml then go dry" is not a moral failing you're nagging about, it's *measurably less water absorbed*. Design implication: the app can frame distribution as **efficiency, not discipline**. "You'll keep more of it" beats "you missed your window."

---

## 1. What existing hydration apps actually do

### The short version

Effectively every mainstream hydration app scores **daily total + streak**. Rolling windows and gap-awareness are almost absent from the category. There is exactly one app I found that has built the concept you're describing, and it's tiny and new.

### The one real precedent: SipFlow (iOS)

This is the closest thing to your idea that ships today. Its model:

- A **"flow state"** derived from a **1-hour rolling window**, with named tiers: *Time for Water* ("No sips in the last hour"), *Light Flow* (1–2 sips), *Good Flow* (3–4 sips), *Strong Flow* (5+).
- A **24-hour grid**: "Blue means you drank. Gray means you didn't." Current hour highlighted.
- Counts **sips (events)**, not millilitres.
- Has "customizable active hours" — but as a display/quiet mask, not a scoring denominator.

Source: [SipFlow on the App Store](https://apps.apple.com/cl/app/sipflow/id6758342451)

Two things worth stealing and one worth rejecting. Steal: the 24-cell binary grid, and the fact that the headline state is a *present-tense condition* ("Time for Water") rather than a score. Reject: counting sips instead of volume — it's trivially gameable (five 10 ml sips = "Strong Flow") and throws away the data you already have.

### P App

Reminders driven by **time since your last logged event** rather than a fixed timer — "shows your daily pattern and sends reminders based on time since your last logged visit." Notable because the *reminder scheduler*, not the *score*, is where the recency concept lives. ([pwaterapp.com](https://pwaterapp.com/))

### WaterMinder

Daily totals, streaks, achievements/badges, weekly/monthly/yearly graphs. Its v7.4 analytics are explicitly **cross-day distribution, not intra-day**: "Goal Achievement Distribution Analytics — See how often your hydration falls within different goal completion ranges over time," "Critical Low Hydration Detection — Track days where hydration intake falls below critical thresholds," "Goal Completion Rate." Also has "AI Gulp Detection" (audio-based sip estimation). **No hour-by-hour breakdown, no time-since-last-drink, no rolling window.** ([App Store](https://apps.apple.com/us/app/waterminder-water-tracker/id653031147), [waterminder.com](https://waterminder.com/))

Note the naming trap: WaterMinder already uses "distribution" to mean *distribution of daily scores across days*. Don't reuse that word for intra-day spread.

### Hydro Coach

Streaks, weekly performance, lifetime total, two-week hydration graph, "most used drink sizes," per-weekday performance. Pro adds monthly stats. Aggregate and per-day — **no intra-day timing analysis**. ([hydrocoach.com](https://hydrocoach.com/), [Google Play](https://play.google.com/store/apps/details?id=com.codium.hydrocoach.pro))

### Waterllama

2022 Apple Design Award finalist. A llama silhouette fills as you drink; 150+ beverages with hydration weighting; goals adjusted for climate/weight/activity; "smart reminders tailored to the user's daily schedule"; streaks and a logs calendar. The core visual is a **cumulative daily fill** — structurally incapable of distinguishing chugger from sipper. ([waterllama.com](https://waterllama.com/), [App Store](https://apps.apple.com/us/app/water-tracker-waterllama/id1454778585))

### Plant Nanny

Gap punishment via metaphor rather than metric: your virtual plant wilts/dies if you don't drink. Emotionally legible, quantitatively useless — and the most punitive model in the category (you literally kill a thing). ([Google Play](https://play.google.com/store/apps/details?id=com.fourdesire.plantnanny2))

### Smart bottles — where the gap concept *does* exist

- **Ulla** — a silicone puck that straps to any bottle. It **blinks if you haven't picked up the bottle in 30–40 minutes**, and the timer *resets on detected pickup*. Pure time-since-last-drink, zero volume, zero daily total, no screen. Silent (light only), 6-month battery, ambient light + proximity sensors so it shuts up at night. ([Amazon listing](https://www.amazon.com/Ulla-Smart-Hydration-Reminder-Black/dp/B017NK0A6I), [review](https://www.zoopy.com/ulla-review/))
- **HidrateSpark** — "SipSense" per-sip tracking in real time, bottle glows to remind, goal computed from age/height/weight/sex adjusted by activity + local weather, two-way Apple Health sync, reminders configurable from 15 min to 10 hours. The reminder interval is user-set and fixed, not adaptive to your actual gap. ([hidratespark.com](https://hidratespark.com/), [App Store](https://apps.apple.com/us/app/hidratespark-water-tracker/id1056269374))

Ulla is the most interesting object here: it proves that **time-since-last-drink alone, with no total and no score, is a shippable product**. It's your feature reduced to one LED.

### Apple Health / Health Connect

Both store water as timestamped quantity samples and surface daily sums. No rolling-window or gap metric is provided by the platform — you'd compute it yourself from the sample timestamps, which you already have locally anyway.

### Verdict on the category

| Concept | Who does it |
|---|---|
| Daily total + goal | everyone |
| Streak | everyone |
| Cross-day consistency stats | WaterMinder, Hydro Coach |
| **Intra-day hourly grid** | **SipFlow only** |
| **Rolling-window state** | **SipFlow (1h), Ulla (30–40 min, hardware)** |
| **Longest gap / time since last** | **P App (as scheduler), Ulla (as hardware timer)** |
| Recency-weighted decay model | **nobody in hydration** |

There is genuine white space here. The decay-model approach in particular is unoccupied in this category.

---

## 2. Rolling-window and recency-weighted metrics in other domains

### Caffeine half-life apps — the closest structural analogue

These are your feature with a different substance. **HalfCup** shows "a visual decay curve that shows your caffeine level drop in real-time," lets you **scrub the timeline forward** to check future levels, has a user-adjustable half-life (2–10 h) for sensitivity, and models a **30-minute absorption window** rather than instantaneous onset. ([App Store](https://apps.apple.com/py/app/caffeine-tracker-halfcup/id6756392479)) Web tools use `C(t) = C₀ × 0.5^(t/half-life)` with multi-dose superposition. ([Caffeine Half-Life Tracker](https://miniwebtool.com/caffeine-half-life-tracker/), [teamzlab](https://tool.teamzlab.com/coffee/caffeine-half-life-calculator/))

Three transferable mechanics: **(a)** superposition of decaying doses gives you one continuous "on board" number for free; **(b)** the absorption ramp means a chug doesn't instantly spike — it eases in, which is both more accurate and visually calmer; **(c)** scrubbing forward converts a passive readout into a *planning* tool ("if I drink nothing, I'm at X by 4pm"). That last one is the single best idea in this section — it's forward-looking, which is inherently non-punitive.

### Sleep debt — RISE

RISE computes sleep debt over a **rolling 14 nights**, deliberately, "which takes the pressure off each single night." The algorithm is **recency-weighted: ~15% of the weight on last night**, because that's what predicts how you feel today. Output is *one number*. ([risescience.com](https://www.risescience.com/blog/best-sleep-debt-tracking-app), [Whoop vs RISE](https://www.risescience.com/blog/whoop-vs-rise-sleep-app))

The lesson isn't the chart, it's the framing: **a longer window is a mercy mechanic.** Widening the window is what lets you say "one bad stretch doesn't define you" while still being quantitative. Your 6h window is *harsher* than an active-hours day score, not gentler — worth being deliberate about that.

### CGM — Time in Range / AGP

The Ambulatory Glucose Profile is the most standardized rolling-window health visual in existence (International Consensus on Time in Range, *Diabetes Care* 2019). Two components matter to you:

1. **TIR/TAR/TBR as a single stacked, color-coded horizontal bar** — green in range, yellow/orange above, red/dark-red below. One bar, whole story, tiny footprint.
2. **The AGP curve** — 14 days of readings collapsed onto **one 24-hour x-axis** with median + interquartile bands, so time-of-day patterns emerge from noise.

Sources: [Diabetes Care consensus](https://diabetesjournals.org/care/article/42/8/1593/36184/Clinical-Targets-for-Continuous-Glucose-Monitoring), [novoMEDLINK AGP](https://www.novomedlink.com/diabetes/hcp-education/clinical/time-in-range/clinical-use/understand-ambulatory-glucose-profile.html), [diaTribe](https://diatribe.org/diabetes-technology/making-most-cgm-uncover-magic-your-ambulatory-glucose-profile)

The AGP overlay is a strong candidate for a *secondary* "your typical day" view: 30 days of your logs collapsed onto one 24h axis instantly reveals "you never drink between 2pm and 6pm" — which is more actionable than any single-day number.

### Medication adherence — the best argument against aggregate scoring

This literature has already fought your exact battle. Liu et al., ["Novel Approaches for Visualizing and Analyzing Dose-Timing Data... or 'How the Broken Window Theory Pertains to ART Adherence'"](https://pmc.ncbi.nlm.nih.gov/articles/PMC4938894/):

- Aggregate percent-of-doses-taken "may overly simplify a complex set of behaviors into a single, **de-nuanced**, summary metric."
- Hypothesis: **micro non-adherence (mistiming) predicts macro non-adherence (skipped doses)** — the "broken window" analogy.
- Empirically: **RMSE of dose timing predicted suboptimal adherence at AROC 0.79**, with each quartile increment roughly **doubling the odds** of outright missed doses.
- Visual forms: uni-modal scatter (date on Y, hours-from-target on X) and bi-modal scatter (date on X, signed early/late on Y) — the bi-modal separates "chronically early" from "chronically late," which the uni-modal can't.

Also standard in this field: **heat maps for pattern-at-a-glance, longitudinal bar/line for exact values** — the same two-tier approach I recommend below. ([AdhereR / PLOS One](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0174426))

Direct translation: **timing variance is a leading indicator.** A user whose intervals get erratic today misses their total tomorrow. That's a defensible reason to surface gaps *before* the daily total goes red — you're warning, not scolding.

### Compact-space visual forms

- **Sparklines** — "tiny visualization designed to fit inside a single cell... shows the shape of a trend without axes, labels, or gridlines." Best for direction-of-travel, not magnitude. ([Wikipedia](https://en.wikipedia.org/wiki/Sparkline), [Domo](https://www.domo.com/learn/charts/sparkline-chart))
- **Horizon charts** — fold a time series into overlapping colored bands to compress vertical space "in a smaller area than a faceted area or line chart." ([Wikipedia](https://en.wikipedia.org/wiki/Horizon_chart), [Observable, "Deliver big insights in small spaces"](https://observablehq.com/blog/big-insights-small-spaces)) **My take: wrong tool here.** Horizon charts earn their keep across *many parallel series*. You have one. The band-folding costs comprehension for compression you don't need.
- The **Stripe dashboard-card pattern** — big number + trend indicator + sparkline — is the reliable default for a compact panel.

---

## 3. Streak and gap visualization

### GitHub contribution graph

The canonical gap visual: 7×52 grid, 5-step opacity ramp. What's instructive is how thoroughly it's been criticized *as a behavioral instrument*:

- Scott Hanselman, ["GitHub Activity Guilt and the Coder's Fitbit"](https://www.hanselman.com/blog/github-activity-guilt-and-the-coders-fitbit): it's an incomplete picture presented as a complete one; it structurally advantages people with more discretionary time. Best line, from his comments — a developer who broke a 129-day streak: **"I lost sight of my actual goal of learning more stuff... the proxy-goal became the actual goal."**
- Gaming: a cron job fakes it perfectly. "If hiring criteria can be fooled by a 5-minute script, you're measuring nothing meaningful." Junior devs committing at midnight to keep it green. ([DEV](https://dev.to/sylwia-lask/your-github-contribution-graph-means-absolutely-nothing-and-heres-why-2kjc))
- Semantic emptiness: a typo fix and a hard architectural fix render identically.

Two of these transfer directly to a per-hour hydration grid: **midnight-commit behavior** (log a sip you didn't take to fill the cell) and **semantic emptiness** (10 ml and 400 ml both make the cell "on" if you binarize like SipFlow).

### Streaks / Habitica / heatmap trackers

- **Streaks** (Apple Design Award): every task is a streak; **missing one day resets to zero.**
- **Habitica**: RPG framing — character takes damage, then *recovers*. Damage is recoverable; a reset streak is not. Meaningfully gentler.
- **Heatmap trackers** (Streakly, HabitHeat, Habit Heatmap): calendar-square heatmaps let you "see when they showed up, where they had gaps, and how consistency changed." A heatmap is a *record*; a streak counter is a *verdict*. ([habitheat.com](https://habitheat.com/heatmap-habit-tracker/), [nervus.io](https://nervus.io/blog/heatmap-effect-habits))
- **Forgiveness mechanics**: Duolingo streak freezes/repairs, HabitBrix streak freeze, Way of Life / Done / Habit Doom's gentler miss handling. The stated principle: "design humane pressure — commitment devices plus forgiveness, so a bad day doesn't nuke months of progress"; **don't catastrophize the loss, celebrate the return.** ([yukaichou.com](https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/), [duoplanet](https://duoplanet.com/duolingo-streak-freeze/))

### What actually reads as "you went 7 hours without"

Ranked by how fast the gap registers:

1. **A wide empty span in a dense strip.** Runs of blank cells are preattentive — you see the *hole*, not the cells. This is why GitHub-style grids work for absence.
2. **An explicitly drawn gap object** — the void rendered as a filled block with its duration typed inside. Inverts figure/ground: draw the silence, not the events. Rare, and the most on-the-nose for your problem.
3. Number-only ("7h 12m gap"). Precise, zero pattern.
4. A line chart with a flat segment. Weakest — flatness reads as "stable," which is the opposite of the intended meaning.

---

## 4. Design critique: known failure modes

### Guilt loops

Fitness-tracker guilt is well documented in the wild, not just theory. Apple Watch ring abandonment: users report days "revolving around those numbers entirely," and — the quote that should be pinned above this feature's spec — **"I feel ashamed but I've been taking a walk at 11:30 p.m. just to complete my ring before midnight."** ([Yahoo/Fortune](https://www.yahoo.com/lifestyle/people-ditching-apple-watches-feeling-170502940.html), [Michigan Daily, "You don't have to close your rings"](https://www.michigandaily.com/opinion/you-dont-have-to-close-your-rings/))

A 6-hour rolling window has a nastier version of this: it never resets. Midnight at least ends the day. A rolling window means there is *no moment at which you are done*. **This is the single largest design risk of the whole concept** and I'd address it explicitly (see recommendation).

### The streak-abandonment cliff

Streak-focused trackers "may produce the failure they're supposed to prevent." Loss aversion means the reset feels like losing all accumulated value at once; the documented pattern is a user seeing a broken streak around week three and never opening the app again. And: the mechanic works for ~50 days, after which **users start protecting the chain rather than the habit.** ([goalsandprogress.com](https://goalsandprogress.com/habit-tracker-trigger-action-reward-two-day-rule/), [habitdoom.com](https://habitdoom.com/blog/what-to-do-when-break-habit-streak))

### Tracking anxiety and disordered use

Real, documented, and specific to quantified health: self-tracking "becomes a source of anxiety, rigidity, and self-judgment"; quantifying intake can trigger eating-disorder-adjacent behaviors; orthorexia is characterized by "difficulty deviating from food rules, often accompanied by guilt, anxiety, or shame." ([National Alliance for Eating Disorders](https://www.allianceforeatingdisorders.com/health-tracking-apps-and-disordered-eating/), [LifeStance](https://lifestance.com/blog/orthorexia/)) Fixation risk is elevated for perfectionists and people with ED or anxiety history.

Water is lower-stakes than calories, but a **rolling-window metric is an inherently more obsessive object than a daily one** — it rewards checking. Design against check-frequency, not for it.

### Compassionate design literature

The pattern in the research: performance-centered features (streaks, competition, normative targets) "evoke guilt, anxiety, or perceived failure when users fall short"; what presents as motivation becomes performance pressure. Prescribed alternatives: **non-judgmental language, emotional validation, reflective prompts**, shifting users "from self-surveillance toward gentler curiosity." ([arXiv: Designing KRIYA](https://arxiv.org/pdf/2601.14589), [Smashing: Empathy-Centred UX for Mental Health Apps](https://www.smashingmagazine.com/2026/02/building-empathy-centred-ux-framework-mental-health-apps/), [Smashing: Designing for Distressed Users](https://www.smashingmagazine.com/2026/07/designing-distressed-users-mental-health-apps-ui/))

> ⚠️ These three sources have **not** been independently verified and may not exist.

### Metric gaming

Goodhart, with specifics. If you score sip *count* (SipFlow), 10 ml sips game it. If you score rolling *volume*, users pre-load before the window closes — the ring-walk at 11:30pm, in liquid form. If you score gaps, users log phantom sips. **The only partly-gaming-resistant framing is one where the metric has no reward attached** — a readout, not a score.

### Notification fatigue

Alert fatigue is thoroughly documented clinically — clinicians override **49–96%** of drug-interaction alerts. ([PMC systematic review protocol](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5729261/)) And consumer-side: "the same app sending the same notification at the same time every day becomes invisible within a week"; habituation to reminders is the default outcome. JITAI research exists precisely to fix this — deliver support "when the person is most in need and receptive," adapting continuously "while minimizing user burden and habituation." ([JMIR JITAI study](https://formative.jmir.org/2022/1/e34309), [JMIR Human Factors](https://humanfactors.jmir.org/2025/1/e66750))

**This is where the rolling window has its clearest, least controversial win.** A gap-triggered notification ("2h 40m — longest gap today") is *event-driven and therefore irregular*, which is exactly the anti-habituation property fixed-interval reminders lack. Ulla implements this in hardware and nothing else. If you ship only one thing from this research, ship gap-triggered reminders.

### The "red = failure" problem

No good design writing found specifically on this — it's an underserved topic. My position, stated as opinion:

**Never color the past.** A gap that already happened is history with no available action; painting it red is a verdict. Color only the *currently running* state, because that's the only thing the user can act on. Concretely: completed gaps render in neutral desaturated slate regardless of length; the *in-progress* gap warms from neutral → amber as it grows. Color then always means "here's a thing you could do," never "here's how you failed."

Second: **use warm/cool, not green/red.** Cyan/slate for hydrated, amber for dry. Avoids the pass/fail read, is colorblind-safe, and matches a dark theme better than saturated green ever does.

Third: **no percentage score, ever.** Show raw quantity and raw duration. "620 ml · last 6h" and "3h 10m since last" are facts. "Hydration score: 62%" is a grade.

---

## 5. Concrete visualization candidates

> Everything from here is **my design proposal**, not existing product behavior. Geometry assumes a 380px panel with 16px side padding → **348px usable**.

---

### A. The Day Tape — 24-cell hour strip

**What it looks like.** 24 rounded cells, 12px wide × 28px tall, 2px radius, 2.5px gaps → 334px, centered in the 348px track. One cell per clock hour, 00→23, left-aligned to midnight. Cell fill is your accent cyan at **4 quantized opacities**: 0% (nothing), 25% (1–99 ml), 55% (100–249 ml), 100% (250 ml+). Empty cells are a 1px `rgba(255,255,255,0.06)` outline with no fill. Future hours: same outline at 0.03 — present but clearly unwritten. Current hour: 1px cyan border plus a 2px cyan underline sitting 4px below the strip. The **rolling window is a bracket**, not a fill: a 1px rule running under the trailing N cells with 3px end-ticks turning up, plus the window's total in 11px mono directly beneath it ("620 ml / 6h"). Sleep hours get a 40% desaturation wash rather than being hidden — you keep the honest 24-hour axis without the 8-hour void reading as failure. Hover a cell → tooltip with exact ml and the individual log timestamps.

**Encodes.** Time-of-day position (x, absolute), volume per hour (opacity, 4 levels), window membership (bracket), now (border).

**Good at.** Gaps read instantly as runs of unfilled outline — the preattentive "hole" effect. Absolute clock position is exact and needs no axis labels (hour 0 is leftmost, done). Renders in ~24 divs, no charting library, no layout thrash. Robust in dark themes where opacity ramps on a dark ground look better than they do on white. Desktop mouse makes a 12px hover target completely fine — this is a form that's cramped on a phone and comfortable here.

**Fails at.** One-hour quantization is a real lie: drinks at 13:59 and 14:01 land in adjacent cells and look like sustained coverage; drinks at 13:01 and 13:59 collapse into one cell and look like a single event. Four opacity steps is roughly the human limit for unaided luminance comparison — you cannot read "how much" beyond a coarse sense. The window bracket is a second, weaker visual language stacked on the first, and it's the part users will ignore. And it inherits GitHub's gameability: the cell doesn't care whether it was 100 ml or 240 ml.

---

### B. Water On Board — decay-curve area sparkline

**What it looks like.** 348 × 56px filled area chart. X = trailing 12 hours, right edge = now. Y = modelled *retained* volume: superpose every log as `ml × 0.5^(Δt / halfLife)` with a 20-minute absorption ramp so a chug eases in instead of spiking (borrowed from HalfCup's 30-min window). Half-life ~3h, user-adjustable. Fill is a vertical gradient from cyan at 65% alpha down to transparent; the top edge is a 1.5px cyan stroke. A 1px dashed rule at 25% alpha marks the "comfortable" level. Right edge terminates in a 3px filled dot with the current value in 22px semibold immediately above the chart. **Drag left-to-right along the chart to scrub**: the dot and the number follow, and dragging past `now` into the dotted projected-decay segment answers "where am I at 4pm if I do nothing."

**Encodes.** A single continuous "how hydrated are you *right now*" scalar, integrating recency and volume in one number, with its full recent shape.

**Good at.** This is **the only candidate where bad distribution is visible as shape rather than inferred from absence.** The chugger draws a mountain that collapses; the sipper draws a plateau; the two are unmistakable at a glance and require no explanation. Continuous — no quantization artifacts. Elegant in a compact dark panel: one gradient, one stroke, one number. The scrub-forward interaction is forward-looking and *plan-shaped*, which is the most reliably non-punitive framing available.

**Fails at.** **It is a model, not your data.** The half-life is invented; there is no hydration equivalent of caffeine's pharmacokinetic literature to point at, and a sophisticated user will ask where 3h came from and you won't have a good answer. It has no event anchors — you cannot see "I drank at 2pm," only that something happened around then. It erases volume identity (400 ml two hours ago and 800 ml four hours ago can land on the same current value). And structurally, **the line is always falling unless you drink**, which is a subtle, persistent, low-grade anxiety generator — the tank is *always* draining, forever.

---

### C. Window Readout — the honest stat bar

**What it looks like.** Three stacked rows in ~72px total. Row 1: `620` in 28px semibold + `ml` in 13px muted, with `last 6h` as a 12px muted label right-aligned on the same baseline. Row 2: a 348 × 6px track, 3px radius, `rgba(255,255,255,0.06)` ground, filled cyan to `620 / (6/16 × dailyGoal)`, clamped at 100% with a subtle brighter cap when over. Row 3: a 3-segment control `6h · 8h · 12h`, 11px, active segment gets a 1px underline.

**Encodes.** One number against one proportional target. That's it.

**Good at.** Zero modelling, zero interpretation, unarguable. Explains itself in one read with no legend and no onboarding. Trivially accessible — the whole thing is announceable as a sentence. Genuinely useful as the *headline* above a richer visual.

**Fails at.** **It is a statistic, not a visualization, and it defeats its own purpose alone.** 200+200+220 spread across six hours and 620 chugged fifty minutes ago render pixel-identical — which is precisely the distinction the entire feature exists to make. It also reintroduces a target, and therefore a shortfall, and therefore a thing to feel bad about, on a clock that never resets. Ship it only as a label attached to something that shows shape.

---

### D. The Gap Ledger — draw the silence

**What it looks like.** A 348 × 22px horizontal track spanning the elapsed portion of the day (or a fixed 24h — I'd use elapsed, so it grows). Drink events are 2px vertical cyan ticks, height 8–22px scaled by ml. **The intervals between ticks are the figure**: each gap is filled with a rounded block whose treatment is driven by duration — under 90 min, invisible (background); 90 min–3h, `rgba(255,255,255,0.05)`; over 3h, a flat amber block at 18% alpha with the duration set in 10px mono *inside* the block, centered, if ≥42px wide. Sleep is a hatched, un-scored region. The **currently running gap** is the only element that animates: its amber warms from 0% to 18% alpha over its first three hours, so it's cool when fresh and glowing when it matters. Below, one line of 12px mono: `Last drink 47m ago · Longest gap 4h 10m`.

**Encodes.** Absence as a first-class object, with duration by both width and color. Events reduced to punctuation.

**Good at.** **Most directly on-target of anything here.** The "chug then dry" case is a single tall tick followed by a wide amber slab — the failure mode is one glance, no interpretation. Inverting figure/ground is the rare design move that actually changes what a user notices. Extremely compact (22px + a text line). And it produces the two numbers users will quote to themselves — "time since last" and "longest gap" — which are memorable in a way that "620 ml in the trailing six hours" isn't.

**Fails at.** **Says nothing about adequacy.** Someone taking a 15 ml sip every 25 minutes draws a flawless gap ledger while being meaningfully dehydrated — the pure-gap metric is *more* gameable than volume, not less. It also requires a sleep mask to avoid an 8-hour amber slab every morning, which drags the "active hours" concept back in (acceptable if it's a *mute*, not a scoring denominator — but be honest that it's still there). And the amber blocks are the highest-guilt element in this entire document: a wide amber bar labelled "4h 10m" is a fairly loud accusation about something you can no longer change. The warm-in animation on only the live gap is what makes this survivable; without it, this design is punitive.

---

### E. Dual-Encode — hour bars with an overlaid rolling line

**What it looks like.** 348 × 48px. 24 slim vertical bars (3px wide, 11px pitch), height ∝ ml logged that hour, in cyan at 50%. Overlaid: a 1.5px smooth line = trailing-6h rolling sum, on its own hidden right-hand scale, in a warmer accent.

**Encodes.** Raw events and the derived rolling metric, together, in one frame.

**Good at.** On paper it's the complete answer: you see what you did *and* what the metric thinks about it, and the line sagging is a warning that needs no red. Good for a debugging or "advanced" view where you're validating the metric against reality.

**Fails at.** **Two unlabelled y-scales in 348px is an unforced error.** It's legible to the person who built it and to nobody else — the reader cannot know whether a bar is tall relative to the line, and the relationship between the two is arbitrary. Adding two axes to make it honest costs 40px and the whole thing stops being compact. **I'd cut this**; I'm listing it because it's the design you converge on if you try to satisfy both goals with one chart, and it's worth knowing in advance that it doesn't work.

---

### F. Sip Clock — 24h radial dial

**What it looks like.** A 120px circle, centered, with 24 wedges (15° each), each filled by that hour's ml. The trailing window is a brighter arc sweeping back from the `now` hand. Center holds the window total.

**Encodes.** Same data as A, in polar.

**Good at.** The clock metaphor makes time-of-day genuinely preattentive — 3pm is *there* without reading. It's the most attractive option and the one that photographs well.

**Fails at.** Radial encoding misrepresents magnitude (wedge area grows with radius²). Labels are near-impossible at this size. It leaves four dead corners in a rectangular panel, so it costs 120px of height to convey less than the 28px Day Tape does. Comparing two non-adjacent wedges by eye is unreliable. **This is the design everyone reaches for first and it should be rejected** — I'm naming it so it gets rejected on purpose rather than prototyped for a week.

---

## Recommendation (run 1)

**Ship D (Gap Ledger) as the hero, with C (Window Readout) as its label. Prototype B (Water On Board) as an alternate view. Don't build E or F.**

**Why D + C.** They divide the work along the one seam that matters: **C says how much, D says how spread out.** Neither can be read as the other, and together they're immune to the two failure cases — the chugger fails D while passing C, the constant-tiny-sipper fails C while passing D. Total vertical cost is about 100px, which fits a compact window alongside everything else. Both are computed *directly from your existing timestamped logs* with no invented model, no half-life to defend, and no parameter a user can argue with. And D produces the two phrases people actually repeat to themselves — "47 minutes since my last drink," "my longest gap today was 4h 10m" — which is what gets a metric internalized. The medication-adherence evidence backs the emphasis: timing variance predicted missed doses at AROC 0.79, i.e. **the gap is the leading indicator and the total is the lagging one**, so the gap deserves the larger visual.

**Why B is worth a prototype but not the default.** It's the only form that renders the insight as *shape*, and the scrub-forward interaction is the best idea in this entire document. But it rests on a fabricated half-life with no hydration literature behind it — caffeine apps get to cite pharmacokinetics and you don't — and a permanently-draining line is a quiet anxiety engine. Build it behind a view toggle, see if it survives your own use for two weeks.

**Three constraints I'd hold regardless of which visual wins:**

1. **Kill the score; keep the readout.** Raw ml and raw durations only. No percentage, no letter, no "hydration score." The moment it's a grade, all the guilt literature above applies to you.
2. **Color only the present.** Past gaps stay neutral slate forever; only the *live* gap warms toward amber as it grows. Color then always means "you could drink now," never "you failed then." Warm/cool, not green/red.
3. **Move active-hours from scorer to muter.** The 8am–10pm window shouldn't compute anything anymore — it should only suppress notifications and mark sleep as un-scored. This is the change that actually delivers on the premise, and it's more important than which chart you pick.

**And the one feature that's separable from all of this and probably the highest-value item here:** switch reminders from fixed-interval to **gap-triggered** — fire when the current gap crosses a threshold, Ulla-style, not every 60 minutes. Fixed-interval reminders demonstrably go invisible within a week; a gap-triggered reminder is irregular by construction and therefore resists habituation, and it's the one thing in this research with both a clinical literature (JITAI) and a shipping hardware precedent behind it. It works with your current UI, before you draw a single new pixel.
