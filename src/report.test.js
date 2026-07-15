'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { eachDay, collectRange, toCSV, toJSON } = require('./report');

function sampleState() {
  const e = (ml) => ({ id: 'x', ml, kind: 'custom', ts: '2026-07-16T09:00:00.000Z' });
  return {
    settings: { dailyGoalMl: 2000, bottleMl: 700 },
    days: {
      '2026-07-14': { totalMl: 2000, goalMl: 2000, entries: [e(1000), e(1000)] },
      '2026-07-15': { totalMl: 500, goalMl: 2000, entries: [e(500)] },
      '2026-07-16': { totalMl: 2500, goalMl: 2000, entries: [e(2500)] },
    },
  };
}

// ---- eachDay --------------------------------------------------------------
test('eachDay lists inclusive calendar days ascending', () => {
  assert.deepEqual(eachDay('2026-07-14', '2026-07-16'), ['2026-07-14', '2026-07-15', '2026-07-16']);
});

test('eachDay crosses a month boundary', () => {
  assert.deepEqual(eachDay('2026-01-30', '2026-02-01'), ['2026-01-30', '2026-01-31', '2026-02-01']);
});

// ---- collectRange ---------------------------------------------------------
test('collectRange computes stats over the recorded days', () => {
  const { days, stats } = collectRange(sampleState(), '2026-07-14', '2026-07-16');
  assert.equal(days.length, 3);
  assert.equal(stats.dayCount, 3);
  assert.equal(stats.totalMl, 5000);
  assert.equal(stats.avgMl, 1667);
  assert.equal(stats.goalHitDays, 2);
  assert.equal(stats.goalHitRate, 67);
  assert.equal(stats.bestDay.date, '2026-07-16');
  assert.equal(stats.bestDay.totalMl, 2500);
  assert.equal(stats.currentStreak, 1); // 16 hit, 15 missed
});

test('collectRange zero-fills missing days with the current goal', () => {
  const { days, stats } = collectRange(sampleState(), '2026-07-13', '2026-07-16');
  assert.equal(days.length, 4);
  assert.equal(days[0].date, '2026-07-13');
  assert.equal(days[0].totalMl, 0);
  assert.equal(days[0].goalMl, 2000);
  assert.equal(stats.avgMl, 1250); // 5000 / 4
  assert.equal(stats.goalHitRate, 50);
});

// ---- toCSV ----------------------------------------------------------------
test('toCSV emits a header and one row per day', () => {
  const { days } = collectRange(sampleState(), '2026-07-14', '2026-07-16');
  const csv = toCSV(days);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'date,total_ml,goal_ml,goal_hit,entry_count');
  assert.equal(lines.length, 4);
  assert.equal(lines[3], '2026-07-16,2500,2000,yes,1');
  assert.equal(lines[2], '2026-07-15,500,2000,no,1');
});

// ---- toJSON ---------------------------------------------------------------
test('toJSON round-trips the full state', () => {
  const state = sampleState();
  const parsed = JSON.parse(toJSON(state));
  assert.deepEqual(parsed, state);
});
