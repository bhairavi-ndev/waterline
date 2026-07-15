'use strict';

/**
 * Hydration pace math (pure, no DOM).
 *
 * "Expected" intake ramps linearly across your awake window (derived from quiet
 * hours) from 0 at wake to the full goal at bedtime. Debt is how far the actual
 * total trails that expectation right now.
 *
 * Loaded both as a CommonJS module (tests) and as a browser global (`Pace`).
 */
(function (root) {
  const FALLBACK = { startMin: 480, endMin: 1320 }; // 08:00–22:00

  function parseHM(str) {
    const [h, m] = String(str || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
    return (h || 0) * 60 + (m || 0);
  }

  /** Awake window in minutes-from-midnight, from quiet hours (or a fallback). */
  function awakeWindow(settings) {
    const q = settings && settings.quietHours;
    if (!q || !q.enabled) return { ...FALLBACK };
    const wake = parseHM(q.end); // quiet hours END = wake up
    const bed = parseHM(q.start); // quiet hours START = go to sleep
    if (bed - wake <= 0) return { ...FALLBACK }; // degenerate / wrapping window
    return { startMin: wake, endMin: bed };
  }

  function expectedFraction(nowMin, win) {
    const span = win.endMin - win.startMin;
    if (span <= 0) return 0;
    const f = (nowMin - win.startMin) / span;
    return Math.max(0, Math.min(1, f));
  }

  function expectedMl(nowMin, goal, win) {
    return Math.round(goal * expectedFraction(nowMin, win));
  }

  /**
   * { expectedMl, debtMl, surplusMl, state } where state is
   * 'behind' | 'ontrack' | 'ahead'. On-track tolerance is ±max(100, 5% of goal).
   */
  function paceStatus({ nowMin, goal, actualMl, win }) {
    const expected = expectedMl(nowMin, goal, win);
    const diff = actualMl - expected; // positive = ahead
    const tol = Math.max(100, goal * 0.05);
    let state = 'ontrack';
    if (Math.abs(diff) > tol) state = diff < 0 ? 'behind' : 'ahead';
    return {
      expectedMl: expected,
      debtMl: Math.max(0, -diff),
      surplusMl: Math.max(0, diff),
      state,
    };
  }

  const api = { parseHM, awakeWindow, expectedFraction, expectedMl, paceStatus };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Pace = api;
})(typeof window !== 'undefined' ? window : null);
