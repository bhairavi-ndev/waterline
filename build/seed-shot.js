'use strict';
// Dev-only: seed a temp userData dir with sample data for smoke screenshots.
//   node build/seed-shot.js <dir>
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) { console.error('usage: seed-shot.js <dir>'); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });

const now = new Date();
const key = (off) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const iso = (off, h, m) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - off, h, m).toISOString();
const goal = 2750;

const days = {};
days[key(0)] = {
  goalMl: goal, totalMl: 1400,
  entries: [
    { id: 'a1', ml: 700, kind: 'bottle', ts: iso(0, 8, 12) },
    { id: 'a2', ml: 350, kind: 'half', ts: iso(0, 10, 40) },
    { id: 'a3', ml: 350, kind: 'half', ts: iso(0, 13, 5) },
  ],
};
const totals = [2800, 2750, 2100, 2900, 2750, 1600, 2750];
for (let i = 1; i <= 7; i++) {
  const t = totals[i - 1];
  days[key(i)] = { goalMl: goal, totalMl: t, entries: [{ id: 'x' + i, ml: t, kind: 'custom', ts: iso(i, 20, 0) }] };
}

const state = {
  version: 1,
  settings: {
    dailyGoalMl: 2750, bottleMl: 700, reminderIntervalMin: 60, remindersEnabled: true,
    quietHours: { enabled: true, start: '22:00', end: '08:00' },
    theme: process.argv[3] || 'dark', launchOnStartup: false, closeToTray: true,
    widgetEnabled: process.argv[4] === 'widget', widgetX: null, widgetY: null,
  },
  days,
};
fs.writeFileSync(path.join(dir, 'waterline.json'), JSON.stringify(state, null, 2));
console.log('seeded', dir);
