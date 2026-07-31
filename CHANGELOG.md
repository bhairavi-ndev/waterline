# Changelog

All notable changes to Waterline are documented here.
This project follows [Semantic Versioning](https://semver.org/).

## [1.3.1] — 2026-07-31

**Fixed**

- **Sleep-hour dimming hid water you'd actually drunk.** Hour cells outside your
  waking window were faded to 40% — including cells that had a drink in them, so
  a 07:20 glass logged before an 08:00 wake time rendered faint, as if it hadn't
  counted. The dimming is there to mark un-scored *absence* during sleep, not to
  hide real water, so it now applies only to empty cells.

No other changes from 1.3.0.

## [1.3.0] — 2026-07-31

### Rhythm — Waterline now tracks *when* you drink, not just how much

The headline change. A daily total can't tell the difference between drinking
800 ml in one go and sipping the same 800 ml across the day — and those are not
the same thing. Two randomised trials found that the **same volume of water
gives up ~20 percentage points of hydration efficiency when bolused instead of
metered** (55% vs 75%, Jones 2010; 53.7% vs 69.1%, McBride 2020). Drinking it
fast dilutes plasma, suppresses vasopressin, and you excrete the surplus.

So Waterline now shows the shape of your day.

**Added**

- **Hour strip** — 24 cells, one per clock hour, showing when you actually
  drank. A dry afternoon reads as an obvious dark band.
- **Anti-chug cap** — cell brightness saturates at 250 ml. An 800 ml bottle
  lights one cell no brighter than a normal glass would, so spreading the day
  out is the only way to fill the strip. The physiology is built into the
  visual, not explained in a tooltip.
- **Time since last drink** — capped at `4h+` on purpose. A counter that climbs
  to "9h 40m" is a guilt meter, and the moment worth reacting to is the next
  drink, not the size of the hole.
- **Longest quiet stretch today** — shown only when it's actually notable, and
  never on a day with nothing logged yet.
- **Intake rail** — a quiet, forward-looking note when the trailing hour carries
  more than ~800 ml, roughly the ceiling of renal free-water excretion. Stays
  silent for a single full bottle.
- `docs/research/` — the full evidence base behind all of the above: a
  physiology literature scan, two UX/visualisation surveys, and a design-decision
  record tracing every number to evidence, extrapolation, or invention. Numbers
  that are guesses are labelled as guesses.

**Changed**

- **Reminders now survive a restart.** The nudge was already counted from your
  last drink, but the anchor lived only in memory, so relaunching the app
  forgave a gap in progress. It now re-anchors to your last actual drink.
  Changing the reminder interval no longer wipes a running gap either. Opening
  the app when you're already overdue waits a short grace instead of firing a
  notification in your face.
- **The "Pace today" chart is gone**, replaced by the hour strip. It plotted
  cumulative intake against a cumulative expectation, which meant it could never
  distinguish a chug from steady sipping. The one-line pace/debt readout stays.
- **Sleep is never scored.** The overnight gap doesn't count against you —
  first-morning urine is the most concentrated of the day by design.
- Design rules applied throughout: no percentage score, no red, and colour only
  on the *live* gap — a stretch that already passed is history you can't act on.

**Fixed**

- The **Add button in the History day-editor overflowed its card**. It inherited
  `width: 100%` from the primary-button style and `flex: none` stopped it
  shrinking, so it laid out at full row width and spilled past the edge.

### Notes on the evidence

Waterline deliberately does **not** claim that spreading your intake improves
any health outcome — no study has shown that at a matched daily total. The
defensible claims are fluid *retention* and how you *feel* (dry mouth, mood,
fatigue). Not kidney protection, not headache prevention, not sharper thinking:
at the 1–2% deficit level a hydration app realistically addresses, the
meta-analytic effect on cognition is small enough to leave alone. See
[`docs/research/`](docs/research/).

## [1.2.0]

- 240 ml glass quick-log.
- Pace-card and day-editor padding fixes.

## [1.1.0]

- Hydration debt and pace.
- Export a report (PDF / CSV / JSON).
- Log or edit any past day.
