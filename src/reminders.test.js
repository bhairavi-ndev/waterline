'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  parseHM,
  nextLocalMidnight,
  inQuietHours,
  quietEndAt,
  nextWake,
  createReminderScheduler,
} = require('./reminders');

// ---- parseHM --------------------------------------------------------------
test('parseHM converts HH:MM to minutes from midnight', () => {
  assert.equal(parseHM('22:00'), 1320);
  assert.equal(parseHM('08:00'), 480);
  assert.equal(parseHM('0:0'), 0);
});

test('parseHM falls back to 0 on garbage', () => {
  assert.equal(parseHM('nonsense'), 0);
  assert.equal(parseHM(undefined), 0);
});

// ---- nextLocalMidnight ----------------------------------------------------
test('nextLocalMidnight returns 00:00 of the following local day', () => {
  const now = new Date(2026, 6, 16, 14, 30, 5);
  const mid = nextLocalMidnight(now);
  assert.equal(mid.getTime(), new Date(2026, 6, 17, 0, 0, 0, 0).getTime());
});

test('nextLocalMidnight just before midnight is one minute away', () => {
  const now = new Date(2026, 6, 16, 23, 59, 0);
  const mid = nextLocalMidnight(now);
  assert.equal(mid.getTime(), new Date(2026, 6, 17, 0, 0, 0, 0).getTime());
});

// ---- inQuietHours (wrapping window) ---------------------------------------
const QUIET = { enabled: true, start: '22:00', end: '08:00' };

test('inQuietHours true late at night and early morning', () => {
  assert.equal(inQuietHours(QUIET, new Date(2026, 6, 16, 23, 0)), true);
  assert.equal(inQuietHours(QUIET, new Date(2026, 6, 16, 7, 0)), true);
});

test('inQuietHours false during the day', () => {
  assert.equal(inQuietHours(QUIET, new Date(2026, 6, 16, 12, 0)), false);
});

test('inQuietHours false when disabled', () => {
  assert.equal(inQuietHours({ enabled: false, start: '22:00', end: '08:00' }, new Date(2026, 6, 16, 23, 0)), false);
});

// ---- quietEndAt -----------------------------------------------------------
test('quietEndAt at night returns 08:00 next day', () => {
  const end = quietEndAt(QUIET, new Date(2026, 6, 16, 23, 0));
  assert.equal(end.getTime(), new Date(2026, 6, 17, 8, 0, 0, 0).getTime());
});

test('quietEndAt in the early morning returns 08:00 same day', () => {
  const end = quietEndAt(QUIET, new Date(2026, 6, 16, 7, 0));
  assert.equal(end.getTime(), new Date(2026, 6, 16, 8, 0, 0, 0).getTime());
});

test('quietEndAt returns null when not in quiet hours', () => {
  assert.equal(quietEndAt(QUIET, new Date(2026, 6, 16, 12, 0)), null);
});

// ---- nextWake -------------------------------------------------------------
const HOUR = 3600 * 1000;

function baseState(now) {
  return {
    now: now.getTime(),
    nudgeAnchor: now.getTime(),
    intervalMs: HOUR,
    remindersActive: true,
    goalMet: false,
    inQuiet: false,
    quietEndsAt: null,
    nextMidnight: nextLocalMidnight(now).getTime(),
  };
}

test('nextWake schedules the next nudge when reminders are active and daytime', () => {
  const now = new Date(2026, 6, 16, 12, 0);
  const t = nextWake(baseState(now));
  assert.equal(t, now.getTime() + HOUR);
});

test('nextWake never schedules past the next midnight (rollover wins)', () => {
  const now = new Date(2026, 6, 16, 23, 30); // nudge would be 00:30 tomorrow
  const t = nextWake(baseState(now));
  assert.equal(t, nextLocalMidnight(now).getTime());
});

test('nextWake waits for quiet-hours end instead of nudging', () => {
  const now = new Date(2026, 6, 16, 7, 0);
  const s = baseState(now);
  s.inQuiet = true;
  s.quietEndsAt = new Date(2026, 6, 16, 8, 0).getTime();
  const t = nextWake(s);
  assert.equal(t, new Date(2026, 6, 16, 8, 0).getTime());
});

test('nextWake only watches for rollover when reminders are disabled', () => {
  const now = new Date(2026, 6, 16, 12, 0);
  const s = baseState(now);
  s.remindersActive = false;
  const t = nextWake(s);
  assert.equal(t, nextLocalMidnight(now).getTime());
});

test('nextWake only watches for rollover when the goal is already met', () => {
  const now = new Date(2026, 6, 16, 12, 0);
  const s = baseState(now);
  s.goalMet = true;
  const t = nextWake(s);
  assert.equal(t, nextLocalMidnight(now).getTime());
});

test('nextWake never returns a time in the past (overdue nudge wakes soon)', () => {
  const now = new Date(2026, 6, 16, 12, 0);
  const s = baseState(now);
  s.nudgeAnchor = now.getTime() - 5 * HOUR; // long overdue
  s.minFloorMs = 1000;
  const t = nextWake(s);
  assert.equal(t, now.getTime() + 1000);
});

// ---- createReminderScheduler (glue, with injected clock + timers) ---------
function makeHarness(opts) {
  let nowMs = opts.now;
  let scheduled = null;
  const fired = [];
  const sched = createReminderScheduler({
    getSettings: opts.getSettings,
    getToday: opts.getToday,
    isPaused: opts.isPaused || (() => false),
    onWake: opts.onWake || (() => {}),
    fireNudge: (day, s, idx) => fired.push({ day, s, idx }),
    now: () => nowMs,
    setTimer: (fn, delay) => { scheduled = { fn, delay }; return 1; },
    clearTimer: () => { scheduled = null; },
  });
  return {
    sched, fired,
    setNow(ms) { nowMs = ms; },
    runTimer() { const s = scheduled; scheduled = null; s.fn(); },
    get scheduled() { return scheduled; },
  };
}

const NOON = new Date(2026, 6, 16, 12, 0).getTime();
const DAY_SETTINGS = { remindersEnabled: true, reminderIntervalMin: 60, quietHours: QUIET };

test('scheduler.start arms the next nudge one interval out', () => {
  const day = { totalMl: 100, goalMl: 2000 };
  const h = makeHarness({ now: NOON, getSettings: () => DAY_SETTINGS, getToday: () => day });
  h.sched.start();
  assert.equal(h.scheduled.delay, HOUR);
});

test('scheduler fires a nudge when the interval has elapsed, then re-arms', () => {
  const day = { totalMl: 100, goalMl: 2000 };
  const h = makeHarness({ now: NOON, getSettings: () => DAY_SETTINGS, getToday: () => day });
  h.sched.start();
  h.setNow(NOON + HOUR);
  h.runTimer();
  assert.equal(h.fired.length, 1);
  assert.equal(h.fired[0].idx, 0);
  assert.equal(h.scheduled.delay, HOUR); // re-armed for the next interval
});

test('scheduler.noteActivity pushes the next nudge out from the new anchor', () => {
  const day = { totalMl: 100, goalMl: 2000 };
  const h = makeHarness({ now: NOON, getSettings: () => DAY_SETTINGS, getToday: () => day });
  h.sched.start();
  h.setNow(NOON + 30 * 60 * 1000);
  h.sched.noteActivity();
  assert.equal(h.scheduled.delay, HOUR);
});

test('scheduler only watches for rollover once the goal is met', () => {
  const day = { totalMl: 2000, goalMl: 2000 };
  const h = makeHarness({ now: NOON, getSettings: () => DAY_SETTINGS, getToday: () => day });
  h.sched.start();
  assert.equal(h.scheduled.delay, nextLocalMidnight(new Date(NOON)).getTime() - NOON);
  h.setNow(NOON + HOUR);
  h.runTimer();
  assert.equal(h.fired.length, 0);
});
