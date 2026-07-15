'use strict';

/**
 * Reminder timing.
 *
 * The scheduling decision is a pure function (`nextWake`) plus a few pure
 * date helpers, so the tricky "when do we wake next" logic is unit-tested.
 * `createReminderScheduler` is thin glue around `setTimeout` that runs a tick
 * callback and re-arms itself for the computed next wake — the app never polls
 * on a fixed interval.
 */

function parseHM(str) {
  const [h, m] = String(str || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return (h || 0) * 60 + (m || 0);
}

/** 00:00 of the following local day. */
function nextLocalMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

function inQuietHours(quietHours, now = new Date()) {
  const q = quietHours;
  if (!q || !q.enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = parseHM(q.start);
  const end = parseHM(q.end);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps past midnight
}

/**
 * The next moment quiet hours end (>= now), or null when not currently quiet.
 * Handles windows that wrap past midnight (22:00 -> 08:00).
 */
function quietEndAt(quietHours, now = new Date()) {
  if (!inQuietHours(quietHours, now)) return null;
  const end = parseHM(quietHours.end);
  const candidate = new Date(
    now.getFullYear(), now.getMonth(), now.getDate(),
    Math.floor(end / 60), end % 60, 0, 0
  );
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

/**
 * Timestamp (ms) the reminder loop should next wake.
 *
 * Always watches for the next local midnight (day rollover). When reminders are
 * active and the goal isn't met, it also aims for the next nudge — or, if in
 * quiet hours, for the moment quiet hours end. Never returns a past time.
 */
function nextWake(state) {
  const {
    now,
    nudgeAnchor,
    intervalMs,
    remindersActive,
    goalMet,
    inQuiet,
    quietEndsAt,
    nextMidnight,
    minFloorMs = 1000,
  } = state;

  const candidates = [nextMidnight];
  if (remindersActive && !goalMet) {
    if (inQuiet) {
      if (quietEndsAt != null) candidates.push(quietEndsAt);
    } else {
      candidates.push(nudgeAnchor + intervalMs);
    }
  }

  let t = Math.min(...candidates);
  if (t < now + minFloorMs) t = now + minFloorMs;
  return t;
}

function intervalMsOf(settings) {
  return Math.max(5, settings.reminderIntervalMin) * 60 * 1000;
}

/**
 * Thin, self-rearming reminder loop. Wakes only at the moment computed by
 * `nextWake` (a nudge, quiet-hours end, or the next midnight) instead of
 * polling. Timing state lives here; side effects are injected callbacks.
 */
function createReminderScheduler(deps) {
  const {
    getSettings,
    getToday,
    isPaused = () => false,
    onWake = () => {},
    fireNudge,
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  } = deps;

  let nudgeAnchor = now();
  let reminderIdx = 0;
  let timer = null;

  function reschedule() {
    if (timer) clearTimer(timer);
    const s = getSettings();
    const t = now();
    const d = new Date(t);
    const quiet = inQuietHours(s.quietHours, d);
    const day = getToday();
    const wakeAt = nextWake({
      now: t,
      nudgeAnchor,
      intervalMs: intervalMsOf(s),
      remindersActive: !!s.remindersEnabled && !isPaused(),
      goalMet: day.totalMl >= day.goalMl,
      inQuiet: quiet,
      quietEndsAt: quiet ? quietEndAt(s.quietHours, d).getTime() : null,
      nextMidnight: nextLocalMidnight(d).getTime(),
    });
    timer = setTimer(tick, Math.max(0, wakeAt - t));
  }

  function tick() {
    onWake(); // day rollover + renderer/tray refresh handled by the host
    const s = getSettings();
    const t = now();
    const active = !!s.remindersEnabled && !isPaused();
    const day = getToday();
    const goalMet = day.totalMl >= day.goalMl;
    if (active && !goalMet && !inQuietHours(s.quietHours, new Date(t))) {
      if (t - nudgeAnchor >= intervalMsOf(s)) {
        fireNudge(day, s, reminderIdx);
        reminderIdx++;
        nudgeAnchor = t;
      }
    }
    reschedule();
  }

  return {
    start() { nudgeAnchor = now(); reschedule(); },
    reschedule,
    noteActivity() { nudgeAnchor = now(); reschedule(); },
    stop() { if (timer) clearTimer(timer); timer = null; },
  };
}

module.exports = {
  parseHM, nextLocalMidnight, inQuietHours, quietEndAt, nextWake,
  createReminderScheduler,
};
