'use strict';

/* =============================================================================
   Waterline renderer
   ========================================================================== */
(function () {
  const api = window.hydrate;
  const SVGNS = 'http://www.w3.org/2000/svg';

  // Bottle interior geometry (must match the clip path in index.html).
  const FILL_TOP = 68;
  const FILL_BOTTOM = 288;
  const FILL_H = FILL_BOTTOM - FILL_TOP; // 220
  const WAVE_AMP = 3;
  const WAVE_LEN = 140;

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- state ---------------------------------------------------------------
  let settings = null;
  let today = null;
  let displayedTotal = 0;
  let histRange = 7;
  let celebrateTimer = null;
  let toastTimer = null;
  let hadGoalBadge = false;
  let editingKey = null; // date key currently open in the History day editor
  let paceTimer = null;  // 60s tick while focused + Today active

  // ---- dom -----------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const el = {
    bottle: document.querySelector('.bottle'),
    waterGroup: $('waterGroup'),
    waveFill: $('waveFill'),
    waveCrest: $('waveCrest'),
    ticks: $('ticks'),
    bubbles: $('bubbles'),
    readoutNum: $('readoutNum'),
    goalNum: $('goalNum'),
    readout: document.querySelector('.readout'),
    celebrate: $('celebrate'),
    celebrateSub: $('celebrateSub'),
    chips: document.querySelector('.chips'),
    chipPct: $('chipPct'),
    chipBottles: $('chipBottles'),
    paceStatus: $('paceStatus'),
    paceMain: $('paceMain'),
    paceSub: $('paceSub'),
    paceCard: $('paceCard'),
    paceHost: $('paceHost'),
    encourage: $('encourage'),
    fullLbl: $('fullLbl'),
    halfLbl: $('halfLbl'),
    addFull: $('addFull'),
    addHalf: $('addHalf'),
    addGlass: $('addGlass'),
    logList: $('logList'),
    logEmpty: $('logEmpty'),
    toast: $('toast'),
    toastMsg: $('toastMsg'),
    toastUndo: $('toastUndo'),
    chartHost: $('chartHost'),
    chartTip: $('chartTip'),
    dayList: $('dayList'),
    histEmpty: $('histEmpty'),
    jumpDate: $('jumpDate'),
    dayEditor: $('dayEditor'),
    dayEditorTitle: $('dayEditorTitle'),
    dayEditorClose: $('dayEditorClose'),
    editList: $('editList'),
    editEmpty: $('editEmpty'),
    editTime: $('editTime'),
    editMl: $('editMl'),
    editAdd: $('editAdd'),
    statStreak: $('statStreak'),
    statAvg: $('statAvg'),
    valGoal: $('valGoal'),
    valBottle: $('valBottle'),
    capBottles: $('capBottles'),
    swReminders: $('swReminders'),
    selInterval: $('selInterval'),
    rowInterval: $('rowInterval'),
    rowQuiet: $('rowQuiet'),
    quietStart: $('quietStart'),
    quietEnd: $('quietEnd'),
    themeSeg: $('themeSeg'),
    swStartup: $('swStartup'),
    swTray: $('swTray'),
    swWidget: $('swWidget'),
    swLowPower: $('swLowPower'),
    exportRange: $('exportRange'),
    exportPdf: $('exportPdf'),
    exportCsv: $('exportCsv'),
    exportJson: $('exportJson'),
    customPop: $('customPop'),
    customBtn: $('customBtn'),
    customInput: $('customInput'),
    customAdd: $('customAdd'),
  };

  // ---- helpers -------------------------------------------------------------
  const fmt = (n) => Math.round(n).toLocaleString('en');
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const kindLabel = (k) => (k === 'bottle' ? 'Full bottle' : k === 'half' ? 'Half' : k === 'glass' ? 'Glass' : 'Custom');

  function pad(n) { return String(n).padStart(2, '0'); }
  function timeLabel(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // ---- wave path (static) --------------------------------------------------
  // The CSS animation slides the wave one period (WAVE_LEN px) per cycle, so
  // the path must overshoot the bottle interior by at least one period on
  // each side or the crest slides out of view mid-cycle.
  function buildWave() {
    const X0 = -2 * WAVE_LEN;
    const X1 = 2 * WAVE_LEN;
    let edge = '';
    for (let x = X0; x <= X1; x += 10) {
      const y = (FILL_TOP + WAVE_AMP * Math.sin((2 * Math.PI * (x + WAVE_LEN)) / WAVE_LEN)).toFixed(2);
      edge += (x === X0 ? 'M' : 'L') + x + ',' + y + ' ';
    }
    el.waveCrest.setAttribute('d', edge.trim());
    el.waveFill.setAttribute('d', `${edge} L${X1},${FILL_TOP + 40} L${X0},${FILL_TOP + 40} Z`);
  }

  // ---- ticks ---------------------------------------------------------------
  function buildTicks() {
    const goal = settings.dailyGoalMl;
    const bottle = Math.max(1, settings.bottleMl);
    const values = new Set();
    for (let k = 1; k * bottle < goal; k++) values.add(k * bottle);
    values.add(goal);
    el.ticks.textContent = '';
    [...values].sort((a, b) => a - b).forEach((val) => {
      const y = FILL_BOTTOM - (val / goal) * FILL_H;
      const g = svg('g', { class: 'tick' });
      g.dataset.val = String(val);
      g.appendChild(svg('line', { x1: 96, y1: y, x2: 108, y2: y }));
      const t = svg('text', { x: 93, y: y + 2.4, 'text-anchor': 'end' });
      t.textContent = fmt(val);
      g.appendChild(t);
      el.ticks.appendChild(g);
    });
    updateTickState();
  }

  function updateTickState() {
    const total = today.totalMl;
    el.ticks.querySelectorAll('.tick').forEach((g) => {
      g.classList.toggle('submerged', Number(g.dataset.val) <= total);
    });
  }

  // ---- count up ------------------------------------------------------------
  let countRaf = 0;
  function countUp(from, to) {
    cancelAnimationFrame(countRaf); // a fresh log supersedes a running count
    if (reduceMotion || from === to) {
      el.readoutNum.textContent = fmt(to);
      displayedTotal = to;
      return;
    }
    const start = performance.now();
    const dur = 600;
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * e);
      el.readoutNum.textContent = fmt(val);
      displayedTotal = val;
      if (t < 1) countRaf = requestAnimationFrame(frame);
    }
    countRaf = requestAnimationFrame(frame);
  }

  // ---- encouragement -------------------------------------------------------
  function encouragement(total, goal) {
    if (total === 0) return 'Nothing logged yet. First sip of the day?';
    const pct = (total / goal) * 100;
    if (total > goal) return 'Above and beyond.';
    if (pct >= 100) return 'Every cell thanks you.';
    if (pct >= 75) return 'Home stretch — one more push.';
    if (pct >= 50) return "Halfway there. The bottle's half full.";
    if (pct >= 25) return 'A quarter down. Steady does it.';
    return 'Good start — keep the bottle close.';
  }

  // ---- bubbles -------------------------------------------------------------
  function spawnBubbles() {
    if (reduceMotion) return;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const c = svg('circle', {
        cx: 40 + Math.random() * 60,
        cy: FILL_TOP + 8,
        r: 1.4 + Math.random() * 1.6,
        fill: 'rgba(255,255,255,0.34)',
      });
      el.bubbles.appendChild(c);
      const rise = 30 + Math.random() * 40;
      const anim = c.animate(
        [
          { transform: `translateY(${rise}px)`, opacity: 0 },
          { opacity: 0.5, offset: 0.3 },
          { transform: 'translateY(0px)', opacity: 0 },
        ],
        { duration: 900 + Math.random() * 500, delay: i * 60, easing: 'cubic-bezier(0.22,1,0.36,1)' }
      );
      anim.onfinish = () => c.remove();
    }
  }

  // ---- celebration ---------------------------------------------------------
  function celebrate() {
    el.celebrateSub.textContent = `${fmt(settings.dailyGoalMl)} ml — every cell thanks you.`;
    el.readout.hidden = true;
    el.celebrate.hidden = false;
    if (!reduceMotion) rippleBurst();
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
      el.celebrate.hidden = true;
      el.readout.hidden = false;
    }, 4000);
  }

  function rippleBurst() {
    const ring = svg('circle', {
      cx: 70, cy: 150, r: 30, fill: 'none',
      class: 'ripple', 'stroke-width': 2,
    });
    el.bottle.appendChild(ring);
    ring.animate(
      [{ r: 30, opacity: 0.7 }, { r: 90, opacity: 0 }],
      { duration: 900, easing: 'cubic-bezier(0.22,1,0.36,1)' }
    ).onfinish = () => ring.remove();
  }

  // ---- main render ---------------------------------------------------------
  function applyDay(day, { animate }) {
    today = day;
    const goal = today.goalMl || settings.dailyGoalMl;
    const total = today.totalMl;
    const pct = clamp(total / goal, 0, 1);
    const remaining = Math.max(0, goal - total);
    const over = total > goal;

    // readout + goal
    el.goalNum.textContent = fmt(goal);
    countUp(animate ? displayedTotal : total, total);
    if (!animate) el.readoutNum.textContent = fmt(total);

    // chips
    const pctShown = Math.round((total / goal) * 100);
    if (over) {
      el.chipPct.textContent = `${pctShown}% · +${fmt(total - goal)} ml over goal`;
    } else {
      el.chipPct.textContent = `${pctShown}% · ${fmt(remaining)} ml to go`;
    }
    if (remaining <= 0) {
      el.chipBottles.textContent = 'Goal met ✓';
    } else if (remaining <= settings.bottleMl / 2) {
      el.chipBottles.textContent = '~½ bottle left';
    } else {
      const n = Math.ceil(remaining / settings.bottleMl);
      el.chipBottles.textContent = `~${n} bottle${n === 1 ? '' : 's'} left`;
    }

    // goal-hit badge persists once hit today
    const hitToday = total >= goal;
    el.chipPct.classList.toggle('goal-badge', hitToday);

    el.encourage.textContent = encouragement(total, goal);

    // bottle fill
    const ty = (1 - pct) * FILL_H;
    if (!animate || reduceMotion) {
      el.waterGroup.style.transition = 'none';
      el.waterGroup.style.transform = `translateY(${ty}px)`;
      // force reflow then restore transition
      el.waterGroup.getBBox();
      requestAnimationFrame(() => { el.waterGroup.style.transition = ''; });
    } else {
      el.waterGroup.style.transform = `translateY(${ty}px)`;
    }
    el.bottle.classList.toggle('is-empty', total === 0);
    el.bottle.classList.toggle('over-goal', over);
    updateTickState();

    // celebration on crossing (only when animating a fresh log)
    if (animate && !hadGoalBadge && hitToday) celebrate();
    hadGoalBadge = hitToday;

    renderLog();
    renderPace();
  }

  function renderLog() {
    el.logList.textContent = '';
    // Newest first, by actual drink time (not insertion order).
    const entries = today.entries.slice().sort((a, b) => new Date(b.ts) - new Date(a.ts));
    el.logEmpty.hidden = entries.length > 0;
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'log-row';
      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = timeLabel(e.ts);
      const ml = document.createElement('span');
      ml.className = 'log-ml';
      ml.textContent = `+${fmt(e.ml)} ml`;
      const kind = document.createElement('span');
      kind.className = 'log-kind';
      kind.textContent = kindLabel(e.kind);
      const rm = document.createElement('button');
      rm.className = 'log-remove';
      rm.textContent = '×';
      rm.title = `Remove ${fmt(e.ml)} ml entry`;
      rm.setAttribute('aria-label', rm.title);
      rm.addEventListener('click', () => removeEntry(e.id));
      li.append(time, ml, kind, rm);
      el.logList.appendChild(li);
    }
  }

  // ---- pace (hydration debt) -----------------------------------------------
  function nowMinutes() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
  function hourLabel(min) {
    let h = Math.round(min / 60) % 24;
    const ap = h < 12 ? 'a' : 'p';
    h %= 12;
    if (h === 0) h = 12;
    return `${h}${ap}`;
  }

  function entryMin(e) {
    const d = new Date(e.ts);
    return d.getHours() * 60 + d.getMinutes();
  }

  function renderPace() {
    if (!settings || !today) return;
    const goal = today.goalMl || settings.dailyGoalMl;
    const win = Pace.awakeWindow(settings);
    const nowMin = nowMinutes();
    // Debt is intake *by now*: entries timestamped later than now (rare — only
    // via backfilling today) don't count toward how far along you should be.
    const entries = today.entries.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const actualByNow = entries.reduce((sum, e) => sum + (entryMin(e) <= nowMin ? e.ml : 0), 0);
    const st = Pace.paceStatus({ nowMin, goal, actualMl: actualByNow, win });

    el.paceStatus.hidden = false;
    el.paceCard.hidden = false;
    el.paceStatus.classList.remove('is-behind', 'is-ahead', 'is-ontrack');
    if (st.state === 'behind') {
      el.paceStatus.classList.add('is-behind');
      el.paceMain.textContent = `Behind by ${fmt(st.debtMl)} ml`;
      el.paceSub.textContent = `expected ~${fmt(st.expectedMl)} ml by now`;
    } else if (st.state === 'ahead') {
      el.paceStatus.classList.add('is-ahead');
      el.paceMain.textContent = `Ahead by ${fmt(st.surplusMl)} ml`;
      el.paceSub.textContent = st.expectedMl > 0 ? `expected ~${fmt(st.expectedMl)} ml by now` : 'ahead of the day’s pace';
    } else {
      el.paceStatus.classList.add('is-ontrack');
      el.paceMain.textContent = 'On track';
      el.paceSub.textContent = st.expectedMl > 0 ? `expected ~${fmt(st.expectedMl)} ml by now` : 'the day is just getting started';
    }

    drawPaceChart(win, goal, nowMin, entries);
  }

  function drawPaceChart(win, goal, nowMin, entries) {
    const host = el.paceHost;
    host.textContent = '';
    const W = host.clientWidth || 340;
    const H = 96;
    const padT = 10, padB = 16, padL = 6, padR = 6;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const x0 = win.startMin, x1 = win.endMin;
    const nowClamped = Math.max(x0, nowMin); // don't draw left of wake
    const spanX = Math.max(1, x1 - x0);
    const maxY = goal * 1.05 || 1;
    const X = (min) => padL + ((clamp(min, x0, x1) - x0) / spanX) * plotW;
    const Y = (ml) => padT + plotH - (clamp(ml, 0, maxY) / maxY) * plotH;

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}` });

    // baseline
    s.appendChild(svg('line', { x1: padL, y1: Y(0), x2: W - padR, y2: Y(0), class: 'pace-axis' }));

    // expected line: (wake, 0) -> (bed, goal)
    s.appendChild(svg('line', {
      x1: X(x0), y1: Y(0), x2: X(x1), y2: Y(goal),
      class: 'pace-expected', 'stroke-dasharray': '4 3',
    }));

    // actual cumulative step-line, only up to now (a monotonic "so far" line)
    let cum = 0;
    const pts = [{ min: x0, ml: 0 }];
    for (const e of entries) {
      const m = entryMin(e);
      if (m > nowMin) break; // entries sorted asc; ignore future-timed ones
      pts.push({ min: m, ml: cum });
      cum += e.ml;
      pts.push({ min: m, ml: cum });
    }
    pts.push({ min: nowClamped, ml: cum }); // extend flat to now

    // gap connector at "now": actual -> expected, colored by state
    const expNow = Pace.expectedMl(nowMin, goal, win);
    s.appendChild(svg('line', {
      x1: X(nowClamped), y1: Y(cum), x2: X(nowClamped), y2: Y(expNow),
      class: 'pace-gap ' + (cum < expNow ? 'is-behind' : 'is-ahead'),
    }));

    let d = '';
    pts.forEach((p, i) => { d += (i === 0 ? 'M' : 'L') + X(p.min).toFixed(1) + ',' + Y(p.ml).toFixed(1) + ' '; });
    s.appendChild(svg('path', { d: d.trim(), class: 'pace-actual', fill: 'none' }));

    // now dot
    s.appendChild(svg('circle', { cx: X(nowClamped), cy: Y(cum), r: 3.2, class: 'pace-now' }));

    // x-axis endpoints
    const lx = svg('text', { x: padL, y: H - 4, 'text-anchor': 'start', class: 'chart-num', 'font-size': 9 });
    lx.textContent = hourLabel(x0);
    const rx = svg('text', { x: W - padR, y: H - 4, 'text-anchor': 'end', class: 'chart-num', 'font-size': 9 });
    rx.textContent = hourLabel(x1);
    s.append(lx, rx);

    host.appendChild(s);
  }

  function todayViewActive() {
    return document.getElementById('view-today').classList.contains('is-active');
  }
  function syncPaceTimer() {
    const shouldRun = !document.hidden && document.hasFocus() && todayViewActive();
    if (shouldRun && !paceTimer) {
      paceTimer = setInterval(renderPace, 60 * 1000);
      renderPace();
    } else if (!shouldRun && paceTimer) {
      clearInterval(paceTimer);
      paceTimer = null;
    }
  }

  function refreshButtonLabels() {
    const full = settings.bottleMl;
    const half = Math.round(full / 2);
    el.fullLbl.textContent = fmt(full);
    el.halfLbl.textContent = fmt(half);
    // Icon-forward buttons: the tooltip carries the words (matches the widget).
    const fullTip = `Log full bottle · ${fmt(full)} ml`;
    const halfTip = `Log half bottle · ${fmt(half)} ml`;
    el.addFull.title = fullTip;
    el.addFull.setAttribute('aria-label', fullTip);
    el.addHalf.title = halfTip;
    el.addHalf.setAttribute('aria-label', halfTip);
  }

  // ---- actions -------------------------------------------------------------
  async function logWater(ml, kind) {
    const amount = Math.max(1, Math.round(ml));
    const day = await api.addWater(amount, kind);
    applyDay(day, { animate: true });
    spawnBubbles();
    showToast(`Logged ${fmt(amount)} ml`);
  }

  async function removeEntry(id) {
    const day = await api.removeEntry(id);
    applyDay(day, { animate: true });
  }

  function showToast(msg, withUndo = true) {
    el.toastMsg.textContent = msg;
    el.toastUndo.hidden = !withUndo;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  async function runExport(format) {
    const range = el.exportRange.value;
    let res;
    try {
      res = await api.exportReport(format, range);
    } catch (_) {
      res = { ok: false };
    }
    if (res && res.ok) showToast(`Exported ${format === 'pdf' ? 'PDF report' : format.toUpperCase()}`, false);
    else if (!res || !res.canceled) showToast('Export failed', false);
  }
  function hideToast() {
    el.toast.classList.remove('show');
    setTimeout(() => { el.toast.hidden = true; }, 260);
  }

  // ---- history -------------------------------------------------------------
  async function renderHistory() {
    const days = await api.getHistory(30); // newest-first
    const shown = days.slice(0, histRange);
    const goal = settings.dailyGoalMl;

    const hasData = days.some((d) => d.totalMl > 0);
    el.histEmpty.hidden = hasData;
    el.chartHost.parentElement.style.display = hasData ? '' : 'none';
    el.dayList.style.display = hasData ? '' : 'none';
    if (!hasData) { el.statStreak.textContent = 'Streak 0d'; el.statAvg.textContent = 'Avg 0 ml'; el.chartHost.textContent = ''; el.dayList.textContent = ''; return; }

    // stats
    const avg = shown.reduce((s, d) => s + d.totalMl, 0) / Math.max(1, shown.length);
    el.statAvg.textContent = `Avg ${fmt(avg)} ml`;
    let streak = 0;
    for (let i = 0; i < days.length; i++) {
      const hit = days[i].totalMl >= days[i].goalMl && days[i].goalMl > 0;
      if (i === 0 && !hit) continue; // today may still be in progress
      if (hit) streak++;
      else break;
    }
    el.statStreak.textContent = `Streak ${streak}d`;

    drawChart(shown.slice().reverse(), goal); // oldest -> newest
    renderDayList(shown);
  }

  function drawChart(data, goal) {
    const host = el.chartHost;
    host.textContent = '';
    const W = host.clientWidth || 340;
    const H = 180;
    const padT = 16, padB = 20, padX = 6;
    const plotW = W - padX * 2;
    const plotH = H - padT - padB;
    const maxVal = Math.max(goal, ...data.map((d) => d.totalMl)) * 1.08 || 1;
    const slot = plotW / data.length;
    const barW = Math.max(4, slot * 0.6);

    const s = svg('svg', { viewBox: `0 0 ${W} ${H}` });

    data.forEach((d, i) => {
      const cx = padX + slot * i + slot / 2;
      const hit = d.totalMl >= d.goalMl && d.goalMl > 0;
      const barH = Math.max(0, (d.totalMl / maxVal) * plotH);
      const y = padT + plotH - barH;
      const isToday = i === data.length - 1;

      const rect = svg('rect', {
        x: cx - barW / 2, y, width: barW, height: barH,
        rx: 3, 'fill-opacity': hit ? 1 : 0.45,
        class: 'bar' + (isToday ? ' today' : ''), tabindex: 0, role: 'img',
      });

      const dt = parseKey(d.date);
      const label = `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]} · ${fmt(d.totalMl)} ml`;
      rect.setAttribute('aria-label', label);
      const show = (ev) => showTip(ev, label, cx, y, s, host);
      rect.addEventListener('mouseenter', show);
      rect.addEventListener('focus', show);
      rect.addEventListener('mouseleave', hideTip);
      rect.addEventListener('blur', hideTip);
      s.appendChild(rect);

      // x label (skip the periodic label when it would crowd today's)
      let xlab = '';
      if (data.length <= 7) xlab = WEEKDAYS[dt.getDay()][0];
      else if (isToday || (i % 5 === 0 && data.length - 1 - i > 1)) xlab = String(dt.getDate());
      if (xlab) {
        const tx = svg('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'chart-num', 'font-size': 10 });
        tx.textContent = xlab;
        s.appendChild(tx);
      }
    });

    // goal hairline drawn over the bars so the reference reads across them;
    // the label carries a surface-colored halo so a tall bar can't swallow it
    const goalY = padT + plotH - (goal / maxVal) * plotH;
    s.appendChild(svg('line', {
      x1: padX, y1: goalY, x2: W - padX, y2: goalY,
      class: 'goal-line', 'stroke-width': 1, 'stroke-dasharray': '3 3',
    }));
    const gl = svg('text', { x: W - padX, y: goalY - 4, 'text-anchor': 'end', class: 'chart-num goal-num', 'font-size': 10 });
    gl.textContent = fmt(goal);
    s.appendChild(gl);

    host.appendChild(s);
  }

  function showTip(ev, label) {
    el.chartTip.textContent = label;
    el.chartTip.hidden = false;
    const r = ev.target.getBoundingClientRect();
    const tipR = el.chartTip.getBoundingClientRect();
    let left = r.left + r.width / 2 - tipR.width / 2;
    left = clamp(left, 8, window.innerWidth - tipR.width - 8);
    el.chartTip.style.left = left + 'px';
    el.chartTip.style.top = Math.max(8, r.top - tipR.height - 8) + 'px';
  }
  function hideTip() { el.chartTip.hidden = true; }

  function renderDayList(shown) {
    el.dayList.textContent = '';
    shown.forEach((d, idx) => {
      const li = document.createElement('li');
      li.className = 'day-row';
      li.dataset.date = d.date;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.title = `Log or edit ${dayName(d.date, idx)}`;
      const name = document.createElement('span');
      name.className = 'day-name';
      name.textContent = dayName(d.date, idx);
      const total = document.createElement('span');
      total.className = 'day-total';
      total.textContent = `${fmt(d.totalMl)} ml`;
      const bottles = document.createElement('span');
      bottles.className = 'day-bottles';
      bottles.textContent = `${(d.totalMl / settings.bottleMl).toFixed(1)} bottles`;
      const badge = document.createElement('span');
      const hit = d.totalMl >= d.goalMl && d.goalMl > 0;
      badge.className = 'day-badge' + (hit ? ' hit' : '');
      badge.title = hit ? 'Goal reached' : 'Goal missed';
      li.append(name, total, bottles, badge);
      li.addEventListener('click', () => openDayEditor(d.date));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDayEditor(d.date); }
      });
      el.dayList.appendChild(li);
    });
  }

  // ---- day editor (log / edit any day) -------------------------------------
  function localKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function friendlyDay(key) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    if (key === localKey()) return 'Today';
    if (key === localKey(y)) return 'Yesterday';
    const d = parseKey(key);
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  function hhmmFromTs(ts) {
    const d = new Date(ts);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function tsForKey(key, hhmm) {
    const [y, m, d] = key.split('-').map(Number);
    const [h, mi] = String(hhmm || '12:00').split(':').map(Number);
    return new Date(y, m - 1, d, h || 0, mi || 0, 0, 0).toISOString();
  }

  async function openDayEditor(key) {
    editingKey = key;
    const day = await api.getDay(key);
    renderDayEditor(key, day);
    el.dayEditor.hidden = false;
    el.jumpDate.value = key;
    const now = new Date();
    el.editTime.value = key === localKey() ? `${pad(now.getHours())}:${pad(now.getMinutes())}` : '12:00';
    el.editMl.value = '';
    el.dayEditor.scrollIntoView({ block: 'nearest' });
  }

  function closeDayEditor() {
    el.dayEditor.hidden = true;
    editingKey = null;
  }

  function renderDayEditor(key, day) {
    el.dayEditorTitle.textContent = friendlyDay(key);
    el.editList.textContent = '';
    const entries = day.entries.slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
    el.editEmpty.hidden = entries.length > 0;
    for (const e of entries) {
      const li = document.createElement('li');
      li.className = 'edit-row';

      const time = document.createElement('input');
      time.type = 'time';
      time.className = 'time edit-row-time';
      time.value = hhmmFromTs(e.ts);
      time.setAttribute('aria-label', 'Entry time');
      time.addEventListener('change', async () => {
        await api.editEntry(e.id, { ts: tsForKey(key, time.value) }, key);
        await refreshAfterEdit(key);
      });

      const mlWrap = document.createElement('span');
      mlWrap.className = 'edit-row-ml';
      const ml = document.createElement('input');
      ml.type = 'number';
      ml.min = '1'; ml.max = '3000'; ml.step = '10';
      ml.value = String(e.ml);
      ml.setAttribute('aria-label', 'Amount, millilitres');
      ml.addEventListener('change', async () => {
        const v = clamp(Math.round(Number(ml.value)) || 1, 1, 3000);
        await api.editEntry(e.id, { ml: v }, key);
        await refreshAfterEdit(key);
      });
      const unit = document.createElement('span');
      unit.textContent = 'ml';
      mlWrap.append(ml, unit);

      const rm = document.createElement('button');
      rm.className = 'edit-row-remove';
      rm.textContent = '×';
      rm.title = 'Remove entry';
      rm.setAttribute('aria-label', 'Remove entry');
      rm.addEventListener('click', async () => {
        await api.removeEntry(e.id, key);
        await refreshAfterEdit(key);
      });

      li.append(time, mlWrap, rm);
      el.editList.appendChild(li);
    }
  }

  async function commitAddEntry() {
    if (!editingKey) return;
    const raw = Number(el.editMl.value);
    if (!Number.isFinite(raw) || raw <= 0) return;
    const ml = clamp(Math.round(raw), 1, 3000);
    try {
      await api.addWater(ml, 'custom', { dateKey: editingKey, ts: tsForKey(editingKey, el.editTime.value) });
    } catch (_) {
      return; // e.g. the future-date guard rejected it
    }
    el.editMl.value = '';
    await refreshAfterEdit(editingKey);
  }

  async function refreshAfterEdit(key) {
    const day = await api.getDay(key);
    renderDayEditor(key, day);
    await renderHistory();
    if (key === localKey()) {
      const s = await api.getState();
      settings = s.settings;
      applyDay(s.today, { animate: false });
    }
  }

  function dayName(key, idx) {
    if (idx === 0) return 'Today';
    if (idx === 1) return 'Yesterday';
    const d = parseKey(key);
    return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }

  // ---- settings ------------------------------------------------------------
  function renderSettings() {
    // Don't clobber a field the user is actively typing in.
    if (document.activeElement !== el.valGoal) el.valGoal.value = String(settings.dailyGoalMl);
    if (document.activeElement !== el.valBottle) el.valBottle.value = String(settings.bottleMl);
    const perDay = Math.ceil(settings.dailyGoalMl / settings.bottleMl);
    el.capBottles.textContent = `That's about ${perDay} bottle${perDay === 1 ? '' : 's'} a day.`;
    el.swReminders.setAttribute('aria-checked', String(settings.remindersEnabled));
    el.selInterval.value = String(settings.reminderIntervalMin);
    el.quietStart.value = settings.quietHours.start;
    el.quietEnd.value = settings.quietHours.end;
    el.swStartup.setAttribute('aria-checked', String(settings.launchOnStartup));
    el.swTray.setAttribute('aria-checked', String(settings.closeToTray));
    el.swWidget.setAttribute('aria-checked', String(settings.widgetEnabled));
    el.swLowPower.setAttribute('aria-checked', String(settings.lowPowerMode));
    [...el.themeSeg.children].forEach((b) => {
      const on = b.dataset.val === settings.theme;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const disabled = !settings.remindersEnabled;
    el.rowInterval.classList.toggle('is-disabled', disabled);
    el.rowQuiet.classList.toggle('is-disabled', disabled);
  }

  async function updateSettings(partial) {
    settings = await api.updateSettings(partial);
    applyLowPower(settings.lowPowerMode);
    refreshButtonLabels();
    renderSettings();
    buildTicks();
    // reflect goal change instantly in the hero
    today.goalMl = settings.dailyGoalMl;
    applyDay(today, { animate: false });
  }

  // ---- theme ---------------------------------------------------------------
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  // ---- power saving --------------------------------------------------------
  // Low power mode strips decorative animation immediately (the GPU-accel half
  // needs a restart, handled in main). Idle-pausing halts the wave whenever the
  // window is unfocused or hidden so it isn't compositing behind other apps.
  function applyLowPower(on) {
    if (on) document.documentElement.setAttribute('data-lowpower', 'true');
    else document.documentElement.removeAttribute('data-lowpower');
  }

  function updateIdle() {
    const idle = document.hidden || !document.hasFocus();
    document.documentElement.classList.toggle('is-idle', idle);
    syncPaceTimer();
  }

  // ---- tabs ----------------------------------------------------------------
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active ? 0 : -1; // roving tabindex
    });
    document.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('is-active', v.id === `view-${name}`);
    });
    if (name === 'history') renderHistory();
    if (name === 'today') renderPace();
    syncPaceTimer();
  }

  // ---- wiring --------------------------------------------------------------
  function wire() {
    document.querySelectorAll('.tab').forEach((t) =>
      t.addEventListener('click', () => switchTab(t.dataset.tab))
    );
    // Arrow-key navigation across the tablist.
    document.querySelector('.tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const tabs = [...document.querySelectorAll('.tab')];
      const idx = tabs.findIndex((t) => t.classList.contains('is-active'));
      const next = tabs[(idx + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      switchTab(next.dataset.tab);
      next.focus();
    });

    el.addFull.addEventListener('click', () => logWater(settings.bottleMl, 'bottle'));
    el.addHalf.addEventListener('click', () => logWater(Math.round(settings.bottleMl / 2), 'half'));
    el.addGlass.addEventListener('click', () => logWater(240, 'glass')); // a fixed 240 ml glass

    // custom popover
    el.customBtn.addEventListener('click', () => togglePopover());
    el.customPop.querySelectorAll('.popover-presets button').forEach((b) =>
      b.addEventListener('click', () => { el.customInput.value = b.dataset.ml; el.customInput.focus(); })
    );
    el.customAdd.addEventListener('click', commitCustom);
    el.customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitCustom();
    });
    el.customPop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        togglePopover(false);
        el.customBtn.focus();
      }
    });
    document.addEventListener('click', (e) => {
      // Ignore clicks anywhere inside the custom-wrap (the trigger button — incl.
      // its inner icon/label — and the popover itself); only outside closes it.
      if (!el.customPop.hidden && !e.target.closest('.custom-wrap')) togglePopover(false);
    });

    el.toastUndo.addEventListener('click', async () => {
      const day = await api.undoLast();
      applyDay(day, { animate: true });
      hideToast();
    });

    // settings controls
    document.querySelectorAll('.stepper').forEach((st) => {
      st.querySelectorAll('.stepper-btn').forEach((btn) =>
        btn.addEventListener('click', () => {
          const key = st.dataset.key;
          const step = Number(st.dataset.step);
          const min = Number(st.dataset.min);
          const max = Number(st.dataset.max);
          const dir = Number(btn.dataset.dir);
          const next = clamp(settings[key] + dir * step, min, max);
          if (next !== settings[key]) updateSettings({ [key]: next });
        })
      );

      // Manual entry: type a value directly into the field.
      const input = st.querySelector('.stepper-val');
      if (input) {
        const key = st.dataset.key;
        const min = Number(st.dataset.min);
        const max = Number(st.dataset.max);
        input.addEventListener('input', () => {
          const digits = input.value.replace(/[^0-9]/g, '');
          if (digits !== input.value) input.value = digits;
        });
        const commit = () => {
          const v = parseInt(input.value, 10);
          if (Number.isFinite(v)) {
            const next = clamp(v, min, max);
            if (next !== settings[key]) { updateSettings({ [key]: next }); return; }
          }
          input.value = String(settings[key]); // revert empty / unchanged / clamped
        };
        input.addEventListener('change', commit); // fires on blur or Enter
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
          else if (e.key === 'Escape') { input.value = String(settings[key]); input.blur(); }
        });
        input.addEventListener('focus', () => input.select());
      }
    });

    el.swReminders.addEventListener('click', () =>
      updateSettings({ remindersEnabled: el.swReminders.getAttribute('aria-checked') !== 'true' })
    );
    el.swStartup.addEventListener('click', () =>
      updateSettings({ launchOnStartup: el.swStartup.getAttribute('aria-checked') !== 'true' })
    );
    el.swTray.addEventListener('click', () =>
      updateSettings({ closeToTray: el.swTray.getAttribute('aria-checked') !== 'true' })
    );
    el.swWidget.addEventListener('click', () =>
      updateSettings({ widgetEnabled: el.swWidget.getAttribute('aria-checked') !== 'true' })
    );
    el.swLowPower.addEventListener('click', () =>
      updateSettings({ lowPowerMode: el.swLowPower.getAttribute('aria-checked') !== 'true' })
    );
    el.exportPdf.addEventListener('click', () => runExport('pdf'));
    el.exportCsv.addEventListener('click', () => runExport('csv'));
    el.exportJson.addEventListener('click', () => runExport('json'));
    el.selInterval.addEventListener('change', () =>
      updateSettings({ reminderIntervalMin: Number(el.selInterval.value) })
    );
    el.quietStart.addEventListener('change', () =>
      updateSettings({ quietHours: { start: el.quietStart.value } })
    );
    el.quietEnd.addEventListener('change', () =>
      updateSettings({ quietHours: { end: el.quietEnd.value } })
    );
    [...el.themeSeg.children].forEach((b) =>
      b.addEventListener('click', () => updateSettings({ theme: b.dataset.val }))
    );

    document.querySelectorAll('#rangeSeg button').forEach((b) =>
      b.addEventListener('click', () => {
        histRange = Number(b.dataset.range);
        document.querySelectorAll('#rangeSeg button').forEach((x) => {
          x.classList.toggle('is-active', x === b);
          x.setAttribute('aria-pressed', String(x === b));
        });
        renderHistory();
      })
    );

    window.addEventListener('resize', () => {
      if (document.getElementById('view-history').classList.contains('is-active')) renderHistory();
      if (todayViewActive()) renderPace();
    });

    // Day editor (log / edit any day)
    el.jumpDate.max = localKey();
    el.jumpDate.addEventListener('change', () => {
      if (el.jumpDate.value) openDayEditor(el.jumpDate.value);
    });
    el.dayEditorClose.addEventListener('click', closeDayEditor);
    el.editAdd.addEventListener('click', commitAddEntry);
    el.editMl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitAddEntry();
    });

    // Pause the wave animation whenever the window is unfocused or hidden.
    window.addEventListener('blur', updateIdle);
    window.addEventListener('focus', updateIdle);
    document.addEventListener('visibilitychange', updateIdle);

    // events from main
    api.onRefresh(async () => {
      const s = await api.getState();
      settings = s.settings;
      applyLowPower(settings.lowPowerMode);
      refreshButtonLabels();
      renderSettings();
      buildTicks();
      hadGoalBadge = s.today.totalMl >= (s.today.goalMl || settings.dailyGoalMl);
      applyDay(s.today, { animate: true });
      if (document.getElementById('view-history').classList.contains('is-active')) renderHistory();
    });
    api.onThemeChanged((theme) => applyTheme(theme));
    api.onNavToday(() => switchTab('today'));
  }

  function togglePopover(force) {
    const open = force === undefined ? el.customPop.hidden : force;
    el.customPop.hidden = !open;
    el.customBtn.setAttribute('aria-expanded', String(open));
    if (open) { el.customInput.value = ''; el.customInput.focus(); }
  }
  function commitCustom() {
    const ml = Math.round(Number(el.customInput.value));
    if (!Number.isFinite(ml) || ml <= 0) return;
    logWater(clamp(ml, 1, 3000), 'custom'); // matches the input's declared max
    togglePopover(false);
  }

  // ---- init ----------------------------------------------------------------
  async function init() {
    const s = await api.getState();
    settings = s.settings;
    today = s.today;
    applyTheme(s.resolvedTheme);
    applyLowPower(settings.lowPowerMode);
    updateIdle();
    buildWave();
    buildTicks();
    refreshButtonLabels();
    renderSettings();
    displayedTotal = 0;
    hadGoalBadge = today.totalMl >= (today.goalMl || settings.dailyGoalMl);
    applyDay(today, { animate: false });
    wire();
    syncPaceTimer();
  }

  init();
})();
