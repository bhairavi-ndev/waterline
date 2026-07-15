'use strict';

/**
 * Report assembly (pure): collect a date range into per-day rows + summary
 * stats, and render CSV / JSON / a self-contained printable HTML document.
 * No Electron or filesystem here — the caller writes the output.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return String(n).padStart(2, '0'); }
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Inclusive list of 'YYYY-MM-DD' keys from fromKey to toKey, ascending. */
function eachDay(fromKey, toKey) {
  const out = [];
  const end = parseKey(toKey);
  for (let d = parseKey(fromKey); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(keyOf(d));
  }
  return out;
}

/** The earliest recorded day key, or today's key when there is no data. */
function earliestKey(state) {
  const keys = Object.keys(state.days || {}).sort();
  return keys[0] || keyOf(new Date());
}

function collectRange(state, fromKey, toKey) {
  const goalFallback = state.settings.dailyGoalMl;
  const days = eachDay(fromKey, toKey).map((date) => {
    const rec = state.days[date];
    const totalMl = rec ? rec.totalMl : 0;
    const goalMl = rec ? rec.goalMl : goalFallback;
    return {
      date,
      totalMl,
      goalMl,
      hit: totalMl >= goalMl && goalMl > 0,
      entryCount: rec ? rec.entries.length : 0,
    };
  });

  const dayCount = days.length;
  const totalMl = days.reduce((s, d) => s + d.totalMl, 0);
  const goalHitDays = days.filter((d) => d.hit).length;
  const bestDay = days.reduce((best, d) => (d.totalMl > best.totalMl ? d : best), { date: null, totalMl: 0 });

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (i === days.length - 1 && !days[i].hit) continue; // last day may be in progress
    if (days[i].hit) currentStreak++;
    else break;
  }

  const stats = {
    dayCount,
    totalMl,
    avgMl: dayCount ? Math.round(totalMl / dayCount) : 0,
    goalHitDays,
    goalHitRate: dayCount ? Math.round((goalHitDays / dayCount) * 100) : 0,
    bestDay: { date: bestDay.date, totalMl: bestDay.totalMl },
    currentStreak,
  };
  return { days, stats };
}

function toCSV(days) {
  const header = 'date,total_ml,goal_ml,goal_hit,entry_count';
  const rows = days.map((d) => `${d.date},${d.totalMl},${d.goalMl},${d.hit ? 'yes' : 'no'},${d.entryCount}`);
  return [header, ...rows].join('\n') + '\n';
}

function toJSON(state) {
  return JSON.stringify(state, null, 2);
}

function fmt(n) { return Math.round(n).toLocaleString('en'); }
function niceDate(key) {
  const d = parseKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** A simple inline-SVG bar chart of daily totals with a goal hairline. */
function barChartSVG(days) {
  const W = 720, H = 200, padT = 12, padB = 24, padX = 8;
  const plotH = H - padT - padB;
  const goal = Math.max(1, ...days.map((d) => d.goalMl));
  const maxVal = Math.max(goal, ...days.map((d) => d.totalMl)) * 1.08 || 1;
  const slot = (W - padX * 2) / Math.max(1, days.length);
  const barW = Math.max(1, Math.min(28, slot * 0.62));
  const goalY = padT + plotH - (goal / maxVal) * plotH;

  let bars = '';
  days.forEach((d, i) => {
    const cx = padX + slot * i + slot / 2;
    const barH = Math.max(0, (d.totalMl / maxVal) * plotH);
    const y = padT + plotH - barH;
    bars += `<rect x="${(cx - barW / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH.toFixed(1)}" rx="2" fill="${d.hit ? '#1faac2' : '#9fb6bd'}"/>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Daily intake">`
    + `<line x1="${padX}" y1="${padT + plotH}" x2="${W - padX}" y2="${padT + plotH}" stroke="#d4dde0" stroke-width="1"/>`
    + bars
    + `<line x1="${padX}" y1="${goalY.toFixed(1)}" x2="${W - padX}" y2="${goalY.toFixed(1)}" stroke="#0e7c8f" stroke-width="1" stroke-dasharray="4 3"/>`
    + `<text x="${W - padX}" y="${(goalY - 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#0e7c8f">goal ${fmt(goal)} ml</text>`
    + `</svg>`;
}

/** Self-contained printable HTML (inline CSS, inline SVG) — no external assets. */
function toHTML({ days, stats, rangeLabel, generatedAt }) {
  const rows = days.map((d) => `<tr>
      <td>${esc(niceDate(d.date))}</td>
      <td class="num">${fmt(d.totalMl)}</td>
      <td class="num">${fmt(d.goalMl)}</td>
      <td class="hit ${d.hit ? 'y' : 'n'}">${d.hit ? '✓' : '—'}</td>
    </tr>`).join('');

  const stat = (label, value) => `<div class="stat"><div class="stat-v">${esc(value)}</div><div class="stat-l">${esc(label)}</div></div>`;
  const best = stats.bestDay.date ? `${fmt(stats.bestDay.totalMl)} ml · ${niceDate(stats.bestDay.date)}` : '—';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Waterline report</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.5 -apple-system, Segoe UI, Roboto, sans-serif; color: #10262b; margin: 32px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #5a747a; margin: 0 0 20px; }
  .stats { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 20px; }
  .stat { flex: 1; min-width: 110px; border: 1px solid #e0e8ea; border-radius: 10px; padding: 12px 14px; }
  .stat-v { font-size: 20px; font-weight: 700; }
  .stat-l { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #5a747a; margin-top: 2px; }
  .chart { border: 1px solid #e0e8ea; border-radius: 10px; padding: 12px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #eef2f3; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #5a747a; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.hit { text-align: center; } td.hit.y { color: #178f5f; } td.hit.n { color: #9fb6bd; }
  .foot { color: #8aa1a6; font-size: 11px; margin-top: 18px; }
</style></head><body>
  <h1>💧 Waterline report</h1>
  <p class="sub">${esc(rangeLabel)} · generated ${esc(generatedAt)}</p>
  <div class="stats">
    ${stat('Daily average', fmt(stats.avgMl) + ' ml')}
    ${stat('Goal-hit rate', stats.goalHitRate + '%')}
    ${stat('Current streak', stats.currentStreak + ' d')}
    ${stat('Best day', best)}
    ${stat('Days tracked', String(stats.dayCount))}
  </div>
  <div class="chart">${barChartSVG(days)}</div>
  <table>
    <thead><tr><th>Date</th><th class="num">Total</th><th class="num">Goal</th><th>Hit</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="foot">Waterline · hydration report</p>
</body></html>`;
}

module.exports = { eachDay, earliestKey, collectRange, toCSV, toJSON, toHTML, keyOf };
