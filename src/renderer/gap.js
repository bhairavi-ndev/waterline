'use strict';

/**
 * Gap / distribution math (pure, no DOM).
 *
 * Loaded both as a CommonJS module (tests) and as a browser global (`Gap`).
 */
(function (root) {
  /** Latest entry timestamp in ms, or null when there are none. */
  function lastTs(entries) {
    let max = null;
    for (const entry of entries || []) {
      const t = new Date(entry.ts).getTime();
      if (Number.isFinite(t) && (max === null || t > max)) max = t;
    }
    return max;
  }

  /**
   * Milliseconds since the most recent drink, or null when nothing is logged.
   * Never negative — a future-dated entry reads as "just now".
   */
  function msSinceLast(entries, nowMs) {
    const last = lastTs(entries);
    if (last === null) return null;
    return Math.max(0, nowMs - last);
  }

  /**
   * ml logged in each local clock hour, as a 24-length array.
   * Entries outside the day are bucketed by their own local hour, so callers
   * should pass a single day's entries.
   */
  function hourlyMl(entries) {
    const out = new Array(24).fill(0);
    for (const entry of entries || []) {
      const d = new Date(entry.ts);
      const h = d.getHours();
      if (h >= 0 && h < 24) out[h] += Number(entry.ml) || 0;
    }
    return out;
  }

  /** Above this, an hour cell stops getting brighter. See docs/research/04. */
  const SATURATE_ML = 250;
  /** Anything logged at all is at least this visible. */
  const FLOOR = 0.3;

  /**
   * Fill level (0..1) for one hour cell.
   *
   * Deliberately saturates at SATURATE_ML: chugging 800 ml in one hour lights a
   * single cell no brighter than a normal glass would, so a well-spread day is
   * the only way to make the strip look full. This is the visual encoding of
   * the bolus-vs-metered retention finding (Jones 2010) — see
   * docs/research/04-design-decisions.md.
   */
  function cellFill(ml, saturateMl = SATURATE_ML) {
    const v = Number(ml) || 0;
    if (v <= 0) return 0;
    if (v >= saturateMl) return 1;
    return FLOOR + (1 - FLOOR) * (v / saturateMl);
  }

  /** Wake/bed instants (ms) for the local day containing `nowMs`. */
  function dayBounds(nowMs, win) {
    const d = new Date(nowMs);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
    return {
      wakeMs: midnight + win.startMin * 60000,
      bedMs: midnight + win.endMin * 60000,
    };
  }

  /**
   * Longest stretch without a drink during today's waking window, including the
   * gap still running right now.
   *
   * Sleep is never scored: the window opens at wake, so the overnight stretch
   * doesn't count against you, and the running gap stops at bedtime rather than
   * growing all night. (First-morning urine is the most concentrated of the day
   * by design — Perrier 2013; see docs/research/01.)
   */
  function longestGapMs(entries, { nowMs, win }) {
    const { wakeMs, bedMs } = dayBounds(nowMs, win);
    const cutoff = Math.min(nowMs, bedMs);
    if (cutoff <= wakeMs) return 0;

    const times = (entries || [])
      .map((entry) => new Date(entry.ts).getTime())
      .filter((t) => Number.isFinite(t) && t > wakeMs && t <= cutoff)
      .sort((a, b) => a - b);

    let cursor = wakeMs;
    let max = 0;
    for (const t of times) {
      if (t - cursor > max) max = t - cursor;
      cursor = t;
    }
    if (cutoff - cursor > max) max = cutoff - cursor;
    return max;
  }

  /** Longest gap we're willing to *show*. Beyond this it reads "4h+". */
  const DISPLAY_CAP_MS = 4 * 60 * 60 * 1000;
  /** Gap length that counts as "time for water". Extrapolated — see docs/research/04. */
  const TARGET_GAP_MS = 3 * 60 * 60 * 1000;

  /**
   * Human label for a gap. Caps at DISPLAY_CAP_MS on purpose: a counter that
   * climbs to "9h 40m" is a guilt meter, and the moment worth reacting to is
   * the next drink, not the size of the hole.
   */
  function formatGap(ms, { capMs = DISPLAY_CAP_MS } = {}) {
    if (ms == null) return '—';
    if (ms >= capMs) return `${Math.floor(capMs / 3600000)}h+`;
    if (ms < 60000) return 'just now';
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  /**
   * 'fresh' | 'due' | 'over' — drives colour on the *live* gap only.
   * Never logged reads 'fresh': a new day must not open in an alarm state.
   */
  function gapLevel(ms, { targetMs = TARGET_GAP_MS } = {}) {
    if (ms == null) return 'fresh';
    if (ms >= targetMs) return 'over';
    if (ms >= targetMs / 2) return 'due';
    return 'fresh';
  }

  /**
   * Footnote for the longest quiet stretch, or '' when it isn't worth saying.
   *
   * Silent on a day with nothing logged — the main readout already says
   * "nothing logged yet", and restating it as a long dry spell is piling on.
   * Silent below the target too: a normal gap needs no commentary.
   */
  function longestGapNote(entries, longestMs, { targetMs = TARGET_GAP_MS } = {}) {
    if (!entries || entries.length === 0) return '';
    if (!(longestMs >= targetMs)) return '';
    return `Longest quiet stretch today · ${formatGap(longestMs)}`;
  }

  /**
   * Roughly max renal free-water excretion (~735–970 ml/h in healthy adults).
   * Past this the surplus is largely excreted rather than retained, and
   * sustained intake above it is the hyponatraemia pathway. See docs/research/01.
   */
  const HOURLY_CEILING_ML = 800;

  /**
   * ml drunk in the trailing window (default 60 min).
   *
   * Deliberately a rolling window rather than the current clock hour: a drink
   * at 19:55 still counts at 20:05, instead of the reading resetting the
   * instant the hour ticks over.
   */
  function trailingMl(entries, nowMs, windowMs = 60 * 60 * 1000) {
    let sum = 0;
    for (const entry of entries || []) {
      const t = new Date(entry.ts).getTime();
      if (Number.isFinite(t) && t <= nowMs && t > nowMs - windowMs) sum += Number(entry.ml) || 0;
    }
    return sum;
  }

  /**
   * A quiet note when one hour carries more water than the body can actually
   * take up. Deliberately silent for a single full bottle — the app's own
   * primary button logs 700 ml, and a hint that fires every time is a nag.
   * Phrased forward ("keep more of it"), never as a scolding.
   */
  function intakeNote(mlThisHour, { ceilingMl = HOURLY_CEILING_ML } = {}) {
    if (!(mlThisHour >= ceilingMl)) return '';
    return 'A lot in one hour — spacing the next one out keeps more of it in.';
  }

  const api = {
    msSinceLast, hourlyMl, cellFill, longestGapMs, dayBounds, formatGap, gapLevel,
    longestGapNote, intakeNote, trailingMl,
    SATURATE_ML, DISPLAY_CAP_MS, TARGET_GAP_MS, HOURLY_CEILING_ML,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Gap = api;
})(typeof window !== 'undefined' ? window : null);
