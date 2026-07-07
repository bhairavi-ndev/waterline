'use strict';

/* =============================================================================
   Waterline desktop widget — a compact, non-activating companion window.
   Shares the app's data via the same preload API (window.hydrate).
   ========================================================================== */
(function () {
  const api = window.hydrate;

  // Bottle interior geometry (matches the clip path in widget.html / index.html).
  const FILL_TOP = 68;
  const FILL_H = 220; // 288 - 68
  const WAVE_AMP = 3;
  const WAVE_LEN = 140;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fmt = (n) => Math.round(n).toLocaleString('en');
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const $ = (id) => document.getElementById(id);
  const el = {
    bottle: document.querySelector('.bottle'),
    waterGroup: $('waterGroup'),
    waveFill: $('waveFill'),
    waveCrest: $('waveCrest'),
    num: $('wNum'),
    goal: $('wGoal'),
    pct: $('wPct'),
    ticks: $('wTicks'),
    full: $('wFull'),
    half: $('wHalf'),
    expand: $('expandBtn'),
    strip: $('dragStrip'),
  };

  let settings = null;
  let displayed = 0;
  let countRaf = 0;

  // ---- wave (static path, same overshoot as the main renderer) -------------
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

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  function countUp(from, to) {
    cancelAnimationFrame(countRaf);
    if (reduceMotion || from === to) {
      el.num.textContent = fmt(to);
      displayed = to;
      return;
    }
    const start = performance.now();
    const dur = 500;
    function frame(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const val = Math.round(from + (to - from) * e);
      el.num.textContent = fmt(val);
      displayed = val;
      if (t < 1) countRaf = requestAnimationFrame(frame);
    }
    countRaf = requestAnimationFrame(frame);
  }

  function render(day, animate) {
    const goal = day.goalMl || settings.dailyGoalMl;
    const total = day.totalMl;
    const pct = clamp(total / goal, 0, 1);

    el.goal.textContent = fmt(goal);
    if (animate) countUp(displayed, total);
    else { el.num.textContent = fmt(total); displayed = total; }
    el.pct.textContent = `${Math.round((total / goal) * 100)}%`;
    el.pct.classList.toggle('hit', total >= goal);

    // quarter graduations submerge as the level passes them
    el.ticks.querySelectorAll('.tick').forEach((g) => {
      g.classList.toggle('submerged', total / goal >= Number(g.dataset.frac));
    });

    const ty = (1 - pct) * FILL_H;
    if (!animate || reduceMotion) {
      el.waterGroup.style.transition = 'none';
      el.waterGroup.style.transform = `translateY(${ty}px)`;
      el.waterGroup.getBBox();
      requestAnimationFrame(() => { el.waterGroup.style.transition = ''; });
    } else {
      el.waterGroup.style.transform = `translateY(${ty}px)`;
    }
    el.bottle.classList.toggle('is-empty', total === 0);
    el.bottle.classList.toggle('over-goal', total > goal);
  }

  function refreshLabels() {
    const b = settings.bottleMl;
    const h = Math.round(b / 2);
    el.full.title = `Log full bottle · ${fmt(b)} ml`;
    el.full.setAttribute('aria-label', el.full.title);
    el.half.title = `Log half bottle · ${fmt(h)} ml`;
    el.half.setAttribute('aria-label', el.half.title);
  }

  async function add(kind) {
    const ml = kind === 'bottle' ? settings.bottleMl : Math.round(settings.bottleMl / 2);
    const day = await api.addWater(ml, kind);
    render(day, true);
  }

  // ---- drag (works even though the window is non-focusable) ----------------
  // Position is computed in the main process from the OS cursor (all DIP), so
  // there's no renderer-physical-px vs DIP mismatch to make the window drift.
  // We only signal start / move / end here.
  function wireDrag() {
    let dragging = false;
    el.strip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      dragging = true;
      api.widgetDragStart();
      try { el.strip.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.strip.addEventListener('pointermove', () => {
      if (dragging) api.widgetDragMove();
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      api.widgetDragEnd();
      try { el.strip.releasePointerCapture(e.pointerId); } catch (_) {}
    };
    el.strip.addEventListener('pointerup', end);
    el.strip.addEventListener('pointercancel', end);
    el.strip.addEventListener('lostpointercapture', () => {
      if (dragging) { dragging = false; api.widgetDragEnd(); }
    });
  }

  function wire() {
    el.full.addEventListener('click', () => add('bottle'));
    el.half.addEventListener('click', () => add('half'));
    el.expand.addEventListener('click', () => api.openApp());
    wireDrag();

    api.onRefresh(async () => {
      const s = await api.getState();
      settings = s.settings;
      refreshLabels();
      render(s.today, true);
    });
    api.onThemeChanged((theme) => applyTheme(theme));
  }

  async function init() {
    const s = await api.getState();
    settings = s.settings;
    applyTheme(s.resolvedTheme);
    buildWave();
    refreshLabels();
    displayed = 0;
    render(s.today, false);
    wire();
  }

  init();
})();
