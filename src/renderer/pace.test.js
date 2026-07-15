'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { awakeWindow, expectedFraction, expectedMl, paceStatus } = require('./pace');

const WIN = { startMin: 480, endMin: 1320 }; // 08:00–22:00, span 840 min

// ---- awakeWindow ----------------------------------------------------------
test('awakeWindow derives the window from quiet hours', () => {
  const w = awakeWindow({ quietHours: { enabled: true, start: '22:00', end: '08:00' } });
  assert.deepEqual(w, { startMin: 480, endMin: 1320 });
});

test('awakeWindow falls back to 08:00–22:00 when quiet hours are off', () => {
  assert.deepEqual(awakeWindow({ quietHours: { enabled: false } }), { startMin: 480, endMin: 1320 });
});

test('awakeWindow falls back on a degenerate window (wake >= bed)', () => {
  // quiet 00:00–06:00 => wake 06:00 (360), bed 00:00 (0) => wake > bed => fallback
  assert.deepEqual(awakeWindow({ quietHours: { enabled: true, start: '00:00', end: '06:00' } }), { startMin: 480, endMin: 1320 });
});

// ---- expectedFraction -----------------------------------------------------
test('expectedFraction is 0 at/before wake, 1 at/after bed, linear between', () => {
  assert.equal(expectedFraction(480, WIN), 0);
  assert.equal(expectedFraction(300, WIN), 0);   // before wake
  assert.equal(expectedFraction(1320, WIN), 1);
  assert.equal(expectedFraction(1440, WIN), 1);  // after bed
  assert.equal(expectedFraction(900, WIN), 0.5); // 15:00 is the midpoint
});

// ---- expectedMl -----------------------------------------------------------
test('expectedMl scales the goal by the fraction', () => {
  assert.equal(expectedMl(900, 2000, WIN), 1000); // midpoint => half the goal
  assert.equal(expectedMl(480, 2000, WIN), 0);
  assert.equal(expectedMl(1320, 2000, WIN), 2000);
});

// ---- paceStatus -----------------------------------------------------------
test('paceStatus reports debt when behind', () => {
  const s = paceStatus({ nowMin: 900, goal: 2000, actualMl: 500, win: WIN });
  assert.equal(s.expectedMl, 1000);
  assert.equal(s.debtMl, 500);
  assert.equal(s.surplusMl, 0);
  assert.equal(s.state, 'behind');
});

test('paceStatus reports on-track within tolerance', () => {
  const s = paceStatus({ nowMin: 900, goal: 2000, actualMl: 1000, win: WIN });
  assert.equal(s.debtMl, 0);
  assert.equal(s.state, 'ontrack');
});

test('paceStatus reports ahead with a surplus', () => {
  const s = paceStatus({ nowMin: 900, goal: 2000, actualMl: 1600, win: WIN });
  assert.equal(s.surplusMl, 600);
  assert.equal(s.state, 'ahead');
});

test('paceStatus tolerance keeps small gaps on-track', () => {
  // goal 2000 => tol = max(100, 5% = 100) = 100; diff +80 stays on-track
  const s = paceStatus({ nowMin: 900, goal: 2000, actualMl: 1080, win: WIN });
  assert.equal(s.state, 'ontrack');
});
