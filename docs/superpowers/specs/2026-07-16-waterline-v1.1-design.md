# Waterline v1.1 — Combined Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation
**Scope:** Four features shipped together as one release: a lighter system
footprint, hydration debt + pace tracking, editable past days, and data export.

---

## 1. Goals

1. **Lighter on the system** — cut steady background CPU and GPU usage; give the
   user an explicit low-power lever.
2. **Hydration debt + pace** — show how far ahead/behind the expected pace the
   user is *right now*, plus a "today's pace" chart (expected vs. actual).
3. **Log / edit past days** — backfill and correct any past day's entries.
4. **Export a report** — PDF (printable), CSV, and JSON backup.

## 2. Non-goals

- Reimporting a JSON backup (export only for now).
- Historical per-day goals (past days snapshot the *current* goal).
- Cloud sync, accounts, or multi-device.
- A full calendar UI for past-day editing (a date picker + panel suffices).

## 3. Architecture

New modules keep logic testable and stop `main.js` (already 622 lines) from
growing further:

| Module | Responsibility | Pure? |
|---|---|---|
| `src/reminders.js` | Event-aligned reminder scheduler | Mostly (takes callbacks/clock) |
| `src/report.js` | Assemble range data + build CSV / JSON / HTML report | Yes |
| `src/renderer/pace.js` | Awake-window + expected/debt math | Yes |

- **Tests:** add Node's built-in `node:test` (Node 18+, zero new deps). A
  `"test": "node --test"` script runs `*.test.js`. Cover the pure modules
  test-first: `pace`, store date-generalization, `report`. Electron-integrated
  behavior (scheduler wiring, GPU flag, export dialog) is verified manually with
  documented steps and the existing `WATERLINE_SHOT` screenshot harness.
- **Settings migration:** `Store._migrate()` already spreads defaults over saved
  state, so the new `lowPowerMode` key appears automatically. No migration code.
  Bump `package.json` version 1.0.0 → 1.1.0 and the Settings footer to `v1.1`.

## 4. Feature A — Lighter on the system *(build first)*

### A1. Event-aligned reminder scheduling
- **Problem:** `setInterval(reminderTick, 30_000)` (`main.js:449`) wakes the CPU
  every 30s forever (~2,880 wakes/day) regardless of state.
- **Change:** extract scheduling into `src/reminders.js` as a self-rescheduling
  `setTimeout`. On each wake it runs the existing tick logic, then computes the
  next wake time = **`min(nextNudgeDue, nextLocalMidnight, quietHoursEndIfInQuiet)`**
  and sleeps until then.
  - Reminders off / paused today / goal met / in quiet hours → no polling;
    schedule the far wake (next local midnight) so day-rollover + celebration
    reset still happen.
  - `nextNudgeDue = nudgeAnchor + intervalMs` (clamped to ≥ now).
- **Reschedule triggers:** app start, after a *today* log, after settings change
  touching reminders/quiet hours, and on `powerMonitor.resume`.
- **Interface:** `createReminderScheduler({ store, getState, notify, onRollover })`
  returning `{ start(), reschedule(), stop() }`. `main.js` wires callbacks;
  scheduler owns timing. Timing is derived from an injectable `now()` for tests.
- **Result:** a handful of wakes/day instead of thousands; reminders still fire
  at the correct time.

### A2. Widget stops compositing when hidden
- Flip the desktop widget's `backgroundThrottling: false` → `true`
  (`main.js:232`). The widget is a non-activating desktop gadget; when occluded
  behind active windows Chromium now idles its wave animation. It repaints when
  the desktop is shown.

### A3. Pause animations when unfocused / hidden
- Toggle an `.is-idle` class on `<html>` from `blur`/`focus` +
  `visibilitychange` in the renderer. CSS sets `animation-play-state: paused` on
  the wave (and stops bubble spawning) so the main window stops churning the GPU
  while the user is in another app but the window is still visible.

### A4. "Low power mode" setting
- New setting `lowPowerMode: false` in `defaultSettings()`. Settings → App gets a
  switch **"Low power mode"**, caption: *"Fewer animations and no GPU
  acceleration. Restart to fully apply."*
- **When on:**
  1. **GPU:** at the very top of `main.js`, before `app.whenReady()`, read the
     settings JSON directly (best-effort `fs.readFileSync` of
     `WATERLINE_USERDATA || app.getPath('userData')/waterline.json`) and call
     `app.disableHardwareAcceleration()` if `lowPowerMode` is true.
     `disableHardwareAcceleration()` **must** be called pre-ready, so toggling it
     needs an app **restart** to fully apply.
  2. **Animations:** broadcast a `data-lowpower="true"` attribute on `<html>`;
     CSS strips *all* decorative animation (wave, bubbles, ripple, count-up),
     behaving like `prefers-reduced-motion`. Applies immediately, no restart.

### A verification
Behavioral: launch with a short reminder interval and confirm the scheduler logs
the next wake and fires on time; confirm the widget animation pauses when
occluded; toggle Low power mode and confirm animations stop immediately and GPU
accel is off after restart (`chrome://gpu` equivalent / `app.getGPUFeatureStatus`).

## 5. Feature B — Hydration debt + pace

### B1. Pace math — `src/renderer/pace.js` (pure)
- `awakeWindow(settings)` → `{ startMin, endMin }` (minutes from midnight).
  - If `quietHours.enabled` and non-degenerate: `startMin = parse(quietHours.end)`
    (wake), `endMin = parse(quietHours.start)` (bed).
  - Fallback to `480..1320` (08:00–22:00) if quiet hours off, `start === end`, or
    the derived window is non-positive (e.g., wake ≥ bed).
- `expectedFraction(nowMin, win)` = `clamp((nowMin − startMin)/(endMin − startMin), 0, 1)`
  (linear ramp; 0 before wake, 1 after bed).
- `expectedMl(nowMin, goal, win)` = `goal × expectedFraction`.
- `paceStatus({ nowMin, goal, actualMl, win })` →
  `{ expectedMl, debtMl, surplusMl, state: 'behind'|'ontrack'|'ahead' }`.
  `debtMl = max(0, expected − actual)`. `ontrack` when within a small tolerance
  (e.g., ±5% of goal or ±100 ml).

### B2. Today status line
- Add one line under the two hero chips (`index.html` `.chips`):
  - behind → `Behind by 320 ml` (warn color) + subtext `Expected ~1,550 by now`.
  - on track / ahead → `On track` / `Ahead by 150 ml` (good color).
- Pre-wake (now < wake) → expected is 0, so state is `ontrack`/neutral.

### B3. "Pace today" mini-chart
- A small card (~110px tall) on the **Today** tab realizing the feedback's ask:
  - x-axis = the awake window (wake → bed) with a few hour ticks.
  - **Expected line:** straight from (wake, 0) to (bed, goal), green/accent.
  - **Actual line:** cumulative step-line from the day's entries (sorted by `ts`),
    ending at "now".
  - Shaded gap between the lines when behind; a "now" dot on the actual line.
  - Built with the same inline-SVG approach as `drawChart`.
- Respects reduce-motion / low-power (static render).

### B4. Live update (no new poll)
Recompute the status line + chart on: a *today* log, Today-tab focus, and a 60s
timer that runs **only while the window is focused and the Today tab is active**
(cleared on blur/hide/tab-switch). Consistent with A3.

## 6. Feature C — Log / edit past days

### C1. Store generalization (`store.js`)
- `addWater(ml, kind, opts = {})` where `opts = { dateKey, ts }`; defaults to
  today / now (backward compatible). Uses `ensureDay(opts.dateKey)`.
- `removeEntry(id, dateKey = today)` and new
  `editEntry(id, { ml, ts }, dateKey = today)`.
- `getDay(key)` → the record (or a zero record `{ totalMl:0, goalMl:current, entries:[] }`).
- `recomputeTotal(day)` helper; edits/removes recompute from entries rather than
  incrementally (safer). Backfilled days snapshot the *current* goal.
- Bounds: ml clamped 1–3000 (matches existing custom-input max); `dateKey` must
  be ≤ today (no future logging).

### C2. IPC discipline (`main.js` / `preload.js`)
- `water:add` payload gains optional `dateKey` + `ts`; `water:remove` gains
  optional `dateKey`; new `entry:edit` and `day:get`.
- **Past-day edits (`dateKey !== today`) must NOT** reset `nudgeAnchor`, call
  `maybeCelebrate`, reschedule reminders, or update the tray tooltip. Only
  today's logs do those. Every past-day edit broadcasts a History refresh.

### C3. History UI (`index.html` / `renderer.js` / `styles.css`)
- Each `day-row` becomes a button → opens an **edit panel** for that date:
  - date header; the day's entries (time + ml + remove ×); an "add entry" row
    (ml number input + `type="time"` input); done/close.
  - Adds/removes/edits call the new IPC and live-refresh the chart, day list, and
    stats.
- A **"Jump to date"** `type="date"` picker at the top of History (max = today)
  loads any past day into the panel, including days beyond the 30-day list.
- Reuses existing `.log-row`, `.popover`, and input styles.

## 7. Feature D — Export a report

### D1. Data assembly — `src/report.js` (pure)
- `collectRange(state, fromKey, toKey)` → `{ days: [{date,totalMl,goalMl,hit,entries}],
  stats: { dayCount, avgMl, streak, goalHitRate, bestDay } }`.
- Range presets resolved in the renderer/main: All time (earliest recorded → today),
  Last 30 days, Last 7 days.

### D2. Formats — `export:run({ format, range })` in main
Uses `dialog.showSaveDialog` for the path, then:
- **CSV** — header `date,total_ml,goal_ml,goal_hit,entry_count` + one row/day.
- **JSON backup** — full `store.getState()` (settings + all days), pretty-printed;
  restore-ready.
- **PDF (printable report)** — `report.js` builds a self-contained HTML string
  (inline CSS + inline SVG bar chart + summary stats + per-day table). Main
  renders it in a hidden offscreen `BrowserWindow`, calls
  `webContents.printToPDF()`, writes the `.pdf`, and destroys the window.

### D3. UI — Settings → new "Data" card
- A range `<select>` (All time / Last 30 days / Last 7 days) + three buttons:
  **Export report (PDF)**, **Export CSV**, **Export JSON backup**. Each invokes
  `export:run`; a toast/among existing patterns confirms success or reports the
  error (e.g., user cancelled the dialog).

## 8. File-by-file impact

- `package.json` — version 1.1.0; `"test": "node --test"`.
- `src/store.js` — date-generalized writes, `getDay`, `getRange`/collect helpers,
  `recomputeTotal`; `lowPowerMode` default.
- `src/main.js` — early low-power GPU read; use `reminders.js`; widget throttling;
  new IPC (`entry:edit`, `day:get`, `export:run`, dated `water:add`/`water:remove`).
- `src/reminders.js` — **new**; scheduler.
- `src/report.js` — **new**; range/collect + CSV/JSON/HTML builders.
- `src/renderer/pace.js` — **new**; pace math.
- `src/preload.js` — new bridge methods.
- `src/renderer/index.html` — pace status line + pace card (Today); History edit
  panel + date picker; Settings Low-power switch + Data card.
- `src/renderer/renderer.js` — pace render + live update; History edit wiring;
  export button wiring; low-power attribute + idle-pause listeners.
- `src/renderer/styles.css` — pace card/line styles; edit panel; low-power/idle
  animation-pause rules.
- `*.test.js` — pace, store, report unit tests.

## 9. Build order

1. **Feature A** (lighter): `reminders.js` + scheduler swap; widget throttle;
   idle-pause; low-power setting + GPU hook. Verify reminders still fire.
2. **Feature C** (store generalization) — foundational for accurate history;
   store writes + IPC + History edit panel.
3. **Feature B** (pace) — `pace.js` + Today status line + pace card.
4. **Feature D** (export) — `report.js` + `export:run` + Settings Data card.

Each step is test-first where a pure module exists, then wired and verified.

## 10. Risks

- **`disableHardwareAcceleration` timing** — must run pre-ready; mitigated by
  reading the settings file directly at `main.js` top. Toggling needs a restart
  (communicated in the caption).
- **Scheduler correctness** — must always wake at next local midnight for
  rollover; covered by unit tests on the next-wake computation and a manual
  short-interval run.
- **Past-day edits leaking into reminders/celebration** — guarded by the
  `dateKey !== today` checks in IPC.
- **`printToPDF` offscreen window** — render must finish before printing; wait for
  `did-finish-load` before `printToPDF`.
