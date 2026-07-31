'use strict';

const test = require('node:test');
const assert = require('node:assert');
const {
  msSinceLast, hourlyMl, cellFill, longestGapMs, formatGap, gapLevel, longestGapNote,
  intakeNote, trailingMl,
} = require('./gap');

const WIN = { startMin: 480, endMin: 1320 }; // 08:00–22:00
const H = 60 * 60 * 1000;

/** Entry factory — `ts` is a local-time ISO string (no trailing Z). */
function e(ts, ml = 250) {
  return { id: ts, ml, kind: 'custom', ts: new Date(ts).toISOString() };
}

const at = (s) => new Date(s).getTime();

// ---- msSinceLast ----------------------------------------------------------
test('msSinceLast is null when nothing is logged', () => {
  assert.strictEqual(msSinceLast([], at('2026-07-31T15:00:00')), null);
});

test('msSinceLast measures from the most recent entry', () => {
  const entries = [e('2026-07-31T09:00:00'), e('2026-07-31T13:30:00')];
  assert.equal(msSinceLast(entries, at('2026-07-31T15:00:00')), 90 * 60 * 1000);
});

test('msSinceLast uses the latest timestamp, not array order', () => {
  // Backfilled entries can land out of order in the array.
  const entries = [e('2026-07-31T13:30:00'), e('2026-07-31T09:00:00')];
  assert.equal(msSinceLast(entries, at('2026-07-31T15:00:00')), 90 * 60 * 1000);
});

test('msSinceLast clamps to 0 for an entry logged in the future', () => {
  const entries = [e('2026-07-31T16:00:00')];
  assert.equal(msSinceLast(entries, at('2026-07-31T15:00:00')), 0);
});

// ---- hourlyMl -------------------------------------------------------------
test('hourlyMl returns 24 zeroes for an empty day', () => {
  const h = hourlyMl([]);
  assert.equal(h.length, 24);
  assert.ok(h.every((v) => v === 0));
});

test('hourlyMl buckets an entry into its local clock hour', () => {
  const h = hourlyMl([e('2026-07-31T13:45:00', 300)]);
  assert.equal(h[13], 300);
  assert.equal(h[12], 0);
  assert.equal(h[14], 0);
});

test('hourlyMl sums several entries in the same hour', () => {
  const h = hourlyMl([e('2026-07-31T09:05:00', 200), e('2026-07-31T09:55:00', 150)]);
  assert.equal(h[9], 350);
});

// ---- cellFill (the anti-chug cap) -----------------------------------------
test('cellFill is 0 for an hour with nothing logged', () => {
  assert.equal(cellFill(0), 0);
});

test('cellFill reaches full at the saturation point', () => {
  assert.equal(cellFill(250), 1);
});

test('cellFill does NOT keep rising past saturation — chugging buys nothing', () => {
  // The whole point: 800 ml in one hour must not look better than 250 ml.
  assert.equal(cellFill(800), 1);
  assert.equal(cellFill(3000), 1);
});

test('cellFill gives a visible floor to a small sip rather than near-invisibility', () => {
  const f = cellFill(20);
  assert.ok(f >= 0.25, `expected a legible floor, got ${f}`);
  assert.ok(f < 1);
});

test('cellFill rises monotonically between the floor and saturation', () => {
  assert.ok(cellFill(100) < cellFill(180));
  assert.ok(cellFill(180) < cellFill(250));
});

// ---- longestGapMs ---------------------------------------------------------
test('longestGapMs measures from wake when nothing is logged yet', () => {
  const gap = longestGapMs([], { nowMs: at('2026-07-31T15:00:00'), win: WIN });
  assert.equal(gap, 7 * H); // 08:00 -> 15:00
});

test('longestGapMs takes the largest interval, before or after a drink', () => {
  const entries = [e('2026-07-31T12:00:00')];
  // 08:00->12:00 is 4h; 12:00->15:00 is 3h.
  assert.equal(longestGapMs(entries, { nowMs: at('2026-07-31T15:00:00'), win: WIN }), 4 * H);
});

test('longestGapMs finds the largest gap between consecutive drinks', () => {
  const entries = [e('2026-07-31T09:00:00'), e('2026-07-31T12:00:00')];
  // 08->09 = 1h, 09->12 = 3h, 12->13 = 1h
  assert.equal(longestGapMs(entries, { nowMs: at('2026-07-31T13:00:00'), win: WIN }), 3 * H);
});

test('longestGapMs ignores the overnight gap — drinks before wake do not count', () => {
  // A 06:00 drink is outside the waking window; the day still starts at 08:00.
  const entries = [e('2026-07-31T06:00:00')];
  assert.equal(longestGapMs(entries, { nowMs: at('2026-07-31T15:00:00'), win: WIN }), 7 * H);
});

test('longestGapMs stops counting at bedtime rather than running all night', () => {
  // Drink every hour 08:00–20:00 so every completed gap is 1h; the only
  // interesting one is the gap still running at 20:00. now is 23:00, but the
  // window shuts at 22:00, so it must read 2h and not 3h.
  const entries = [];
  for (let h = 8; h <= 20; h++) entries.push(e(`2026-07-31T${String(h).padStart(2, '0')}:00:00`));
  assert.equal(longestGapMs(entries, { nowMs: at('2026-07-31T23:00:00'), win: WIN }), 2 * H);
});

test('longestGapMs counts a long dry daytime stretch even after bedtime', () => {
  // Woke at 08:00, drank nothing until 20:00 — that is a real 12h gap.
  const entries = [e('2026-07-31T20:00:00')];
  assert.equal(longestGapMs(entries, { nowMs: at('2026-07-31T23:00:00'), win: WIN }), 12 * H);
});

test('longestGapMs is 0 before the waking window opens', () => {
  assert.equal(longestGapMs([], { nowMs: at('2026-07-31T06:30:00'), win: WIN }), 0);
});

// ---- formatGap ------------------------------------------------------------
test('formatGap shows a dash when nothing has been logged', () => {
  assert.equal(formatGap(null), '—');
});

test('formatGap reads "just now" under a minute', () => {
  assert.equal(formatGap(30 * 1000), 'just now');
});

test('formatGap shows whole minutes under an hour', () => {
  assert.equal(formatGap(47 * 60 * 1000), '47m');
});

test('formatGap shows hours and minutes past an hour', () => {
  assert.equal(formatGap(2 * H + 10 * 60 * 1000), '2h 10m');
});

test('formatGap omits a zero minute component', () => {
  assert.equal(formatGap(3 * H), '3h');
});

test('formatGap caps the display so it never becomes a guilt counter', () => {
  // Design rule: never render "9h 40m". See docs/research/04.
  assert.equal(formatGap(9 * H + 40 * 60 * 1000), '4h+');
  assert.equal(formatGap(4 * H), '4h+');
});

// ---- gapLevel -------------------------------------------------------------
test('gapLevel is fresh soon after a drink', () => {
  assert.equal(gapLevel(20 * 60 * 1000, { targetMs: 3 * H }), 'fresh');
});

test('gapLevel becomes due approaching the target', () => {
  assert.equal(gapLevel(2 * H, { targetMs: 3 * H }), 'due');
});

test('gapLevel goes over once the target is passed', () => {
  assert.equal(gapLevel(3 * H, { targetMs: 3 * H }), 'over');
});

test('gapLevel treats "never logged" as fresh, not as failure', () => {
  // A brand new day must not open in an alarm state.
  assert.equal(gapLevel(null, { targetMs: 3 * H }), 'fresh');
});

// ---- longestGapNote -------------------------------------------------------
test('longestGapNote stays silent when nothing has been logged', () => {
  // The readout already says "nothing logged yet" — restating it as a 4h+
  // quiet stretch is piling on.
  assert.equal(longestGapNote([], 12 * H), '');
});

test('longestGapNote stays silent for an unremarkable gap', () => {
  assert.equal(longestGapNote([e('2026-07-31T12:00:00')], 90 * 60 * 1000), '');
});

test('longestGapNote reports a gap at or past the target', () => {
  const note = longestGapNote([e('2026-07-31T12:00:00')], 3 * H);
  assert.match(note, /3h/);
});

test('longestGapNote respects the display cap', () => {
  assert.match(longestGapNote([e('2026-07-31T12:00:00')], 9 * H), /4h\+/);
});

// ---- intakeNote -----------------------------------------------------------
test('intakeNote says nothing about an ordinary hour', () => {
  assert.equal(intakeNote(0), '');
  assert.equal(intakeNote(240), '');
});

test('intakeNote does NOT fire on a single full bottle', () => {
  // The default bottle is 700 ml. Nagging on the app's primary button every
  // time is exactly the behaviour the design rules rule out.
  assert.equal(intakeNote(700), '');
});

test('intakeNote flags an hour past the renal free-water ceiling', () => {
  // ~800 ml/h is roughly max renal free-water excretion — above this the
  // surplus is largely excreted. See docs/research/01 §design implication 2.
  assert.notEqual(intakeNote(800), '');
  assert.notEqual(intakeNote(1500), '');
});

// ---- trailingMl -----------------------------------------------------------
test('trailingMl is 0 with nothing logged', () => {
  assert.equal(trailingMl([], at('2026-07-31T20:00:00')), 0);
});

test('trailingMl sums the last 60 minutes', () => {
  const entries = [e('2026-07-31T19:20:00', 700), e('2026-07-31T19:50:00', 240)];
  assert.equal(trailingMl(entries, at('2026-07-31T20:00:00')), 940);
});

test('trailingMl ignores drinks older than the window', () => {
  const entries = [e('2026-07-31T18:30:00', 700), e('2026-07-31T19:50:00', 240)];
  assert.equal(trailingMl(entries, at('2026-07-31T20:00:00')), 240);
});

test('trailingMl spans clock-hour boundaries', () => {
  // The whole reason this exists: a 19:55 drink must still count at 20:05,
  // instead of the hint blinking out when the clock hour ticks over.
  const entries = [e('2026-07-31T19:55:00', 900)];
  assert.equal(trailingMl(entries, at('2026-07-31T20:05:00')), 900);
});

test('intakeNote is forward-looking, not a scolding', () => {
  const note = intakeNote(1000);
  assert.doesNotMatch(note, /too much|slow down|careful|warning/i);
});
