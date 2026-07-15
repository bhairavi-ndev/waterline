'use strict';

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { Store, dateKey } = require('./store');

let counter = 0;
function freshStore() {
  const p = path.join(os.tmpdir(), `waterline-test-${process.pid}-${counter++}.json`);
  try { fs.unlinkSync(p); } catch (_) { /* not there */ }
  return new Store(p);
}

function keyOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// ---- today (unchanged behavior) -------------------------------------------
test('addWater logs to today by default', () => {
  const s = freshStore();
  s.addWater(250, 'custom');
  assert.equal(s.getToday().totalMl, 250);
  assert.equal(s.getToday().entries.length, 1);
});

test('addWater preserves the glass kind', () => {
  const s = freshStore();
  const day = s.addWater(240, 'glass');
  assert.equal(day.entries.at(-1).kind, 'glass');
});

test('addWater clamps ml to [1, 3000]', () => {
  const s = freshStore();
  const big = s.addWater(99999, 'custom');
  assert.equal(big.entries.at(-1).ml, 3000);
  const small = s.addWater(0, 'custom');
  assert.equal(small.entries.at(-1).ml, 1);
});

// ---- past days ------------------------------------------------------------
test('addWater with a past dateKey does not touch today', () => {
  const s = freshStore();
  const past = keyOffset(-3);
  s.addWater(500, 'custom', { dateKey: past });
  assert.equal(s.getDay(past).totalMl, 500);
  assert.equal(s.getToday().totalMl, 0);
});

test('addWater with an explicit ts stores that timestamp', () => {
  const s = freshStore();
  const past = keyOffset(-2);
  const ts = `${past}T09:30:00.000Z`;
  s.addWater(300, 'custom', { dateKey: past, ts });
  assert.equal(s.getDay(past).entries[0].ts, ts);
});

test('addWater refuses a future date', () => {
  const s = freshStore();
  assert.throws(() => s.addWater(250, 'custom', { dateKey: keyOffset(1) }), /future/i);
});

test('getDay returns a zero record (current goal) for an unrecorded day', () => {
  const s = freshStore();
  const rec = s.getDay(keyOffset(-10));
  assert.equal(rec.totalMl, 0);
  assert.equal(rec.entries.length, 0);
  assert.equal(rec.goalMl, s.getSettings().dailyGoalMl);
});

test('a backfilled day snapshots the current goal', () => {
  const s = freshStore();
  s.updateSettings({ dailyGoalMl: 3000 });
  const past = keyOffset(-4);
  s.addWater(250, 'custom', { dateKey: past });
  assert.equal(s.getDay(past).goalMl, 3000);
});

// ---- edit / remove on any day ---------------------------------------------
test('removeEntry on a past day recomputes the total', () => {
  const s = freshStore();
  const past = keyOffset(-1);
  const day = s.addWater(200, 'custom', { dateKey: past });
  s.addWater(300, 'custom', { dateKey: past });
  const id = day.entries[0].id;
  s.removeEntry(id, past);
  assert.equal(s.getDay(past).totalMl, 300);
  assert.equal(s.getDay(past).entries.length, 1);
});

test('editEntry updates ml and recomputes the total', () => {
  const s = freshStore();
  const past = keyOffset(-1);
  const day = s.addWater(200, 'custom', { dateKey: past });
  const id = day.entries[0].id;
  s.editEntry(id, { ml: 450 }, past);
  assert.equal(s.getDay(past).entries[0].ml, 450);
  assert.equal(s.getDay(past).totalMl, 450);
});

test('editEntry updates the timestamp', () => {
  const s = freshStore();
  const day = s.addWater(200, 'custom');
  const id = day.entries[0].id;
  const ts = `${dateKey()}T06:15:00.000Z`;
  s.editEntry(id, { ts }, dateKey());
  assert.equal(s.getToday().entries[0].ts, ts);
});
