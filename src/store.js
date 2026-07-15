'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Simple JSON-file persistence for hydration data.
 * Lives in the Electron `userData` directory so it survives app updates.
 */

const CURRENT_VERSION = 1;

/** Hard bounds for numeric settings (bottleMl is used as a divisor). */
const SETTING_BOUNDS = {
  dailyGoalMl: [500, 6000],
  bottleMl: [100, 3000],
  reminderIntervalMin: [5, 240],
};

function clampSettings(settings, fallback) {
  for (const key of Object.keys(SETTING_BOUNDS)) {
    const [lo, hi] = SETTING_BOUNDS[key];
    const n = Math.round(Number(settings[key]));
    settings[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback[key];
  }
  return settings;
}

function defaultSettings() {
  return {
    dailyGoalMl: 2750,
    bottleMl: 700,
    reminderIntervalMin: 60,
    remindersEnabled: true,
    quietHours: { enabled: true, start: '22:00', end: '08:00' },
    theme: 'system', // 'light' | 'dark' | 'system'
    lowPowerMode: false, // disable GPU accel (needs restart) + strip animations
    launchOnStartup: false,
    closeToTray: true,
    widgetEnabled: false,
    widgetX: null, // null => auto-place bottom-right on first show
    widgetY: null,
  };
}

function defaultState() {
  return {
    version: CURRENT_VERSION,
    settings: defaultSettings(),
    days: {}, // keyed by 'YYYY-MM-DD'
  };
}

/** Local calendar date as 'YYYY-MM-DD' (not UTC). */
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** ml bounds for a single entry (matches the custom-amount input's max). */
const ML_BOUNDS = [1, 3000];
function clampMl(ml) {
  const n = Math.round(Number(ml) || 0);
  return Math.min(ML_BOUNDS[1], Math.max(ML_BOUNDS[0], n));
}

/** 'YYYY-MM-DD' strings sort lexically, so a plain compare gives date order. */
function isFutureKey(key) {
  return key > dateKey();
}

class Store {
  constructor(filePath) {
    this.filePath = filePath;
    this.state = this._read();
  }

  _read() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return this._migrate(parsed);
    } catch (err) {
      // Missing or corrupt file -> start fresh.
      return defaultState();
    }
  }

  _migrate(parsed) {
    const base = defaultState();
    const state = {
      version: CURRENT_VERSION,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
    };
    // Merge nested quietHours defaults if partial.
    state.settings.quietHours = {
      ...base.settings.quietHours,
      ...((parsed.settings && parsed.settings.quietHours) || {}),
    };
    clampSettings(state.settings, base.settings);
    return state;
  }

  _write() {
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(tmp, this.filePath); // atomic-ish replace
  }

  getState() {
    return this.state;
  }

  getSettings() {
    return this.state.settings;
  }

  /** Ensure a day record exists and return it. Snapshots the goal for that day. */
  ensureDay(key = dateKey()) {
    if (!this.state.days[key]) {
      this.state.days[key] = {
        totalMl: 0,
        goalMl: this.state.settings.dailyGoalMl,
        entries: [],
      };
    }
    return this.state.days[key];
  }

  getToday() {
    return this.ensureDay();
  }

  /** A day record without creating one — a transient zero record when absent. */
  getDay(key) {
    return this.state.days[key] || {
      totalMl: 0,
      goalMl: this.state.settings.dailyGoalMl,
      entries: [],
    };
  }

  recomputeTotal(day) {
    day.totalMl = day.entries.reduce((sum, e) => sum + e.ml, 0);
    return day;
  }

  /**
   * Log water. Defaults to today/now; pass { dateKey, ts } to backfill a past
   * day (a new past-day record snapshots the current goal). Refuses the future.
   */
  addWater(ml, kind = 'custom', opts = {}) {
    const amount = clampMl(ml);
    const k = ['bottle', 'half', 'custom'].includes(kind) ? kind : 'custom';
    const key = opts.dateKey || dateKey();
    if (isFutureKey(key)) throw new RangeError('cannot log water for a future date');
    const day = this.ensureDay(key);
    const ts = opts.ts || new Date().toISOString();
    day.entries.push({ id: makeId(), ml: amount, kind: k, ts });
    day.totalMl += amount;
    this._write();
    return day;
  }

  undoLast() {
    const day = this.getToday();
    const entry = day.entries.pop();
    if (entry) {
      day.totalMl = Math.max(0, day.totalMl - entry.ml);
      this._write();
    }
    return day;
  }

  removeEntry(id, key = dateKey()) {
    const day = this.state.days[key];
    if (!day) return this.getDay(key);
    const idx = day.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      day.entries.splice(idx, 1);
      this.recomputeTotal(day);
      this._write();
    }
    return day;
  }

  /** Edit an entry's ml and/or timestamp on any day, then recompute the total. */
  editEntry(id, patch = {}, key = dateKey()) {
    const day = this.state.days[key];
    if (!day) return this.getDay(key);
    const entry = day.entries.find((e) => e.id === id);
    if (entry) {
      if (patch.ml != null) entry.ml = clampMl(patch.ml);
      if (patch.ts != null) entry.ts = patch.ts;
      this.recomputeTotal(day);
      this._write();
    }
    return day;
  }

  updateSettings(partial) {
    const prev = this.state.settings;
    this.state.settings = {
      ...prev,
      ...partial,
    };
    if (partial && partial.quietHours) {
      this.state.settings.quietHours = {
        ...prev.quietHours,
        ...partial.quietHours,
      };
    }
    clampSettings(this.state.settings, prev);
    // Keep today's snapshot goal in sync when the goal is changed.
    const today = this.state.days[dateKey()];
    if (today && partial && typeof partial.dailyGoalMl === 'number') {
      today.goalMl = partial.dailyGoalMl;
    }
    this._write();
    return this.state.settings;
  }

  /** Return last N days (including empty days as zero) newest-first. */
  getHistory(nDays = 30) {
    const out = [];
    const now = new Date();
    for (let i = 0; i < nDays; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = dateKey(d);
      const rec = this.state.days[key];
      out.push({
        date: key,
        totalMl: rec ? rec.totalMl : 0,
        goalMl: rec ? rec.goalMl : this.state.settings.dailyGoalMl,
        entries: rec ? rec.entries : [],
      });
    }
    return out;
  }
}

module.exports = { Store, dateKey, defaultState, defaultSettings };
