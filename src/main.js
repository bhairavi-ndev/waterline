'use strict';

const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  Tray,
  Menu,
  dialog,
  nativeImage,
  nativeTheme,
  powerMonitor,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { Store, dateKey } = require('./store');
const { createReminderScheduler } = require('./reminders');
const report = require('./report');

const APP_ID = 'com.kaamil.waterline';
const APP_NAME = 'Waterline';
const ASSETS = path.join(__dirname, '..', 'assets');

// Low-power mode's GPU switch must be honored BEFORE the app is ready
// (`disableHardwareAcceleration` is only valid pre-ready), so read the saved
// settings file directly here rather than waiting for the Store.
try {
  const udBase = process.env.WATERLINE_USERDATA || app.getPath('userData');
  const saved = JSON.parse(fs.readFileSync(path.join(udBase, 'waterline.json'), 'utf8'));
  if (saved && saved.settings && saved.settings.lowPowerMode) app.disableHardwareAcceleration();
} catch (_) {
  /* no saved settings yet -> default (GPU on) */
}

let mainWindow = null;
let widgetWindow = null;
let widgetSaveTimer = null;
let widgetDrag = null; // { dx, dy } offset from cursor to window origin while dragging
let tray = null;
let store = null;
let scheduler = null;

let lastDayKey = dateKey();
let celebratedDayKey = null; // guards the once-a-day goal toast
let pausedDayKey = null; // 'Pause reminders today' from the tray
let isQuitting = false;

// ---------------------------------------------------------------------------
// Theme helpers
// ---------------------------------------------------------------------------
const THEME_COLORS = {
  light: { bg: '#EDF4F5', symbol: '#0F2E33' },
  dark: { bg: '#07181D', symbol: '#E6F4F6' },
};

function resolvedTheme() {
  const t = store ? store.getSettings().theme : 'system';
  if (t === 'light' || t === 'dark') return t;
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
}

function applyTheme(theme) {
  nativeTheme.themeSource = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
}

function syncTitleBarOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const c = THEME_COLORS[resolvedTheme()];
  try {
    mainWindow.setTitleBarOverlay({ color: c.bg, symbolColor: c.symbol, height: 44 });
  } catch (_) {
    /* setTitleBarOverlay only valid when overlay is enabled */
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  const c = THEME_COLORS[resolvedTheme()];
  mainWindow = new BrowserWindow({
    width: 420,
    height: 680,
    minWidth: 380,
    minHeight: 560,
    show: false,
    backgroundColor: c.bg,
    icon: path.join(ASSETS, 'icon.png'),
    title: APP_NAME,
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: c.bg, symbolColor: c.symbol, height: 44 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Keep compositing frames flowing during the dev screenshot run so
      // capturePage never returns a stale frame when the window is occluded.
      backgroundThrottling: !process.env.WATERLINE_SHOT,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => {
    if (!app.getLoginItemSettings().wasOpenedAtLogin) mainWindow.show();
  });

  // Dev-only smoke hook: screenshot each tab + surface renderer errors, then quit.
  if (process.env.WATERLINE_SHOT) {
    const fs = require('fs');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    mainWindow.webContents.on('console-message', (_e, level, message, line, src) => {
      console.log(`[renderer:${level}] ${message} (${src}:${line})`);
    });
    mainWindow.webContents.on('preload-error', (_e, p, err) => console.log('[preload-error]', p, String(err)));
    mainWindow.webContents.once('did-finish-load', async () => {
      const base = process.env.WATERLINE_SHOT.replace(/\.png$/i, '');
      const shot = async (name) => {
        mainWindow.webContents.invalidate(); // force a fresh frame
        await wait(150);
        const img = await mainWindow.webContents.capturePage();
        fs.writeFileSync(`${base}-${name}.png`, img.toPNG());
        console.log('[shot]', name);
      };
      try {
        await wait(1600);
        await shot('today');
        await mainWindow.webContents.executeJavaScript("document.querySelector('[data-tab=history]').click()");
        await wait(800);
        await shot('history');
        await mainWindow.webContents.executeJavaScript("document.querySelector('#rangeSeg [data-range=\"30\"]').click()");
        await wait(500);
        await shot('history30');
        await mainWindow.webContents.executeJavaScript("document.querySelector('#rangeSeg [data-range=\"7\"]').click()");
        await mainWindow.webContents.executeJavaScript("document.querySelector('[data-tab=settings]').click()");
        await wait(500);
        await shot('settings');
        // scroll to the new Low-power + Data controls at the bottom of Settings
        await mainWindow.webContents.executeJavaScript("document.querySelector('.set-foot').scrollIntoView({ block: 'end' })");
        await wait(300);
        await shot('settings-bottom');
        // custom-amount popover opens (regression guard)
        await mainWindow.webContents.executeJavaScript("document.querySelector('[data-tab=today]').click()");
        await wait(400);
        await mainWindow.webContents.executeJavaScript("document.getElementById('customBtn').click()");
        await wait(300);
        await shot('custom');
        // exercise real logs end-to-end (a full bottle + a 240 ml glass)
        await mainWindow.webContents.executeJavaScript("document.getElementById('addFull').click()");
        await wait(400);
        await mainWindow.webContents.executeJavaScript("document.getElementById('addGlass').click()");
        await wait(1100);
        await shot('afterlog');
        // day editor: backfill 250 ml to yesterday via the jump-to-date picker
        const yKey = (() => {
          const d = new Date(); d.setDate(d.getDate() - 1);
          const p = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
        })();
        await mainWindow.webContents.executeJavaScript("document.querySelector('[data-tab=history]').click()");
        await wait(400);
        await mainWindow.webContents.executeJavaScript(`(() => { const d = document.getElementById('jumpDate'); d.value = '${yKey}'; d.dispatchEvent(new Event('change')); })()`);
        await wait(500);
        await mainWindow.webContents.executeJavaScript("(() => { const m = document.getElementById('editMl'); m.value = '250'; document.getElementById('editAdd').click(); })()");
        await wait(600);
        await shot('editor');
      } catch (e) {
        console.log('[shot-error]', String(e));
      }
      isQuitting = true;
      app.quit();
    });
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.getSettings().closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow(navToToday = false) {
  if (!mainWindow) {
    createWindow();
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      if (navToToday) mainWindow.webContents.send('nav:today');
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (navToToday) mainWindow.webContents.send('nav:today');
}

// ---------------------------------------------------------------------------
// Desktop widget
//
// A frameless, transparent, NON-ACTIVATING panel (focusable:false) with
// alwaysOnTop:false. It never steals focus and sits below the active window,
// so it shows on the desktop when apps are minimized and tucks behind whatever
// you're working in — a "pinned to the desktop" gadget without fragile native
// WorkerW reparenting.
// ---------------------------------------------------------------------------
const WIDGET_W = 212;
const WIDGET_H = 244;

function widgetDefaultPos() {
  const wa = screen.getPrimaryDisplay().workArea;
  return { x: wa.x + wa.width - WIDGET_W - 24, y: wa.y + wa.height - WIDGET_H - 24 };
}

/** Clamp a saved position back onto some visible display (handles unplugged monitors). */
function clampToScreen(x, y) {
  const disp = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const wa = disp.workArea;
  return {
    x: Math.round(Math.min(Math.max(x, wa.x), wa.x + wa.width - WIDGET_W)),
    y: Math.round(Math.min(Math.max(y, wa.y), wa.y + wa.height - WIDGET_H)),
  };
}

function createWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.showInactive();
    return;
  }
  const s = store.getSettings();
  const base = s.widgetX == null || s.widgetY == null ? widgetDefaultPos() : { x: s.widgetX, y: s.widgetY };
  const pos = clampToScreen(base.x, base.y);

  widgetWindow = new BrowserWindow({
    width: WIDGET_W,
    height: WIDGET_H,
    x: pos.x,
    y: pos.y,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: false,
    focusable: false, // non-activating: never steals focus, stays behind active windows
    hasShadow: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    backgroundColor: '#00000000',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Let Chromium idle the wave animation while the widget is occluded behind
      // active windows — it only needs to paint when the desktop is visible.
      backgroundThrottling: true,
    },
  });

  widgetWindow.loadFile(path.join(__dirname, 'renderer', 'widget.html'));
  widgetWindow.setAlwaysOnTop(false);
  widgetWindow.once('ready-to-show', () => widgetWindow.showInactive());
  widgetWindow.on('closed', () => { widgetWindow = null; });

  // Dev-only: capture the widget then quit.
  if (process.env.WATERLINE_WIDGET_SHOT) {
    const fs = require('fs');
    widgetWindow.webContents.on('console-message', (_e, level, message, line, src) =>
      console.log(`[widget:${level}] ${message} (${src}:${line})`));
    widgetWindow.webContents.once('did-finish-load', async () => {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        widgetWindow.webContents.invalidate();
        await new Promise((r) => setTimeout(r, 150));
        const img = await widgetWindow.webContents.capturePage();
        fs.writeFileSync(process.env.WATERLINE_WIDGET_SHOT, img.toPNG());
        console.log('[widget-shot] wrote', process.env.WATERLINE_WIDGET_SHOT);
      } catch (e) {
        console.log('[widget-shot-error]', String(e));
      }
      isQuitting = true;
      app.quit();
    });
  }
}

function destroyWidget() {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.destroy();
  widgetWindow = null;
}

function setWidgetEnabled(enabled) {
  if (enabled) createWidget();
  else destroyWidget();
}

function toggleWidgetFromTray() {
  const next = !store.getSettings().widgetEnabled;
  store.updateSettings({ widgetEnabled: next });
  setWidgetEnabled(next);
  rebuildTray();
  refreshRenderer(); // update the Settings switch in the main window
}

/** Debounced persistence of the widget's dragged position. */
function scheduleWidgetSave() {
  if (widgetSaveTimer) clearTimeout(widgetSaveTimer);
  widgetSaveTimer = setTimeout(() => {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      const [x, y] = widgetWindow.getPosition();
      store.updateSettings({ widgetX: x, widgetY: y });
    }
  }, 600);
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
function trayIcon() {
  const img = nativeImage.createFromPath(path.join(ASSETS, 'tray.png'));
  return img.isEmpty() ? nativeImage.createFromPath(path.join(ASSETS, 'icon.png')) : img;
}

function logFromTray(ml, kind) {
  const prev = store.getToday().totalMl;
  const day = store.addWater(ml, kind);
  if (scheduler) scheduler.noteActivity();
  maybeCelebrate(prev, day);
  refreshRenderer();
  updateTrayTooltip(day);
}

function isPausedToday() {
  return pausedDayKey === dateKey();
}

function buildTrayMenu() {
  const s = store.getSettings();
  return Menu.buildFromTemplate([
    { label: `Open ${APP_NAME}`, click: () => showWindow(true) },
    { type: 'separator' },
    { label: `Log full bottle (${s.bottleMl} ml)`, click: () => logFromTray(s.bottleMl, 'bottle') },
    { label: `Log half (${Math.round(s.bottleMl / 2)} ml)`, click: () => logFromTray(Math.round(s.bottleMl / 2), 'half') },
    { type: 'separator' },
    { label: s.widgetEnabled ? 'Hide desktop widget' : 'Show desktop widget', click: toggleWidgetFromTray },
    {
      label: isPausedToday() ? 'Resume reminders' : 'Pause reminders today',
      click: () => {
        pausedDayKey = isPausedToday() ? null : dateKey();
        rebuildTray();
        if (scheduler) scheduler.reschedule();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function rebuildTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function updateTrayTooltip(day = store.getToday()) {
  if (!tray) return;
  const pct = Math.round((day.totalMl / Math.max(1, day.goalMl)) * 100);
  tray.setToolTip(`${APP_NAME} — ${day.totalMl.toLocaleString('en')} / ${day.goalMl.toLocaleString('en')} ml (${pct}%)`);
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => showWindow(true));
  updateTrayTooltip();
}

// ---------------------------------------------------------------------------
// Reminders
//
// Timing lives in ./reminders (createReminderScheduler): the loop wakes only at
// the next meaningful moment (a nudge, quiet-hours end, or midnight rollover)
// rather than polling every 30s. This file supplies the side effects.
// ---------------------------------------------------------------------------
function checkDayRollover() {
  const today = dateKey();
  if (today !== lastDayKey) {
    lastDayKey = today;
    celebratedDayKey = null;
    store.ensureDay(today);
    refreshRenderer();
    updateTrayTooltip();
    return true;
  }
  return false;
}

function reminderCopy(day, s, idx) {
  const remaining = Math.max(0, day.goalMl - day.totalMl);
  const bottles = Math.max(1, Math.ceil(remaining / Math.max(1, s.bottleMl)));
  const total = day.totalMl.toLocaleString('en');
  const rem = remaining.toLocaleString('en');
  const half = Math.round(s.bottleMl / 2);
  const pctAfterHalf = Math.min(100, Math.round(((day.totalMl + half) / Math.max(1, day.goalMl)) * 100));
  const variants = [
    { title: 'Time for a sip', body: `You're at ${total} ml — ${rem} to go. About ${bottles} bottle${bottles === 1 ? '' : 's'} left.` },
    { title: 'Water break', body: `It's been a while since your last drink. A half bottle takes you to ${pctAfterHalf}%.` },
    { title: 'Your bottle misses you', body: `${total} ml down, ${rem} to go. Keep it moving.` },
  ];
  return variants[idx % variants.length];
}

function buildScheduler() {
  return createReminderScheduler({
    getSettings: () => store.getSettings(),
    getToday: () => store.getToday(),
    isPaused: isPausedToday,
    onWake: checkDayRollover,
    fireNudge: (day, s, idx) => {
      if (!Notification.isSupported()) return;
      const n = new Notification({ ...reminderCopy(day, s, idx), icon: path.join(ASSETS, 'icon.png'), silent: false });
      n.on('click', () => showWindow(true));
      n.show();
    },
  });
}

function maybeCelebrate(prevTotal, day) {
  if (celebratedDayKey === dateKey()) return;
  if (prevTotal < day.goalMl && day.totalMl >= day.goalMl) {
    celebratedDayKey = dateKey();
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'Goal reached',
        body: `${day.goalMl.toLocaleString('en')} ml today. Your future self says thanks.`,
        icon: path.join(ASSETS, 'icon.png'),
        silent: false,
      });
      n.on('click', () => showWindow(true));
      n.show();
    }
  }
}

// ---------------------------------------------------------------------------
// Renderer sync (main window + widget stay in lockstep)
// ---------------------------------------------------------------------------
function liveWindows() {
  return [mainWindow, widgetWindow].filter((w) => w && !w.isDestroyed());
}

function refreshRenderer() {
  for (const w of liveWindows()) w.webContents.send('today:refresh');
}

/** Refresh every window except the one that initiated the change (it self-updates). */
function refreshOthers(exceptWc) {
  for (const w of liveWindows()) {
    if (w.webContents.id !== exceptWc.id) w.webContents.send('today:refresh');
  }
}

// ---------------------------------------------------------------------------
// IPC
// ---------------------------------------------------------------------------
function registerIpc() {
  ipcMain.handle('app:getState', () => ({
    settings: store.getSettings(),
    today: store.getToday(),
    todayKey: dateKey(),
    resolvedTheme: resolvedTheme(),
    paused: isPausedToday(),
  }));

  // Today's logs drive reminders/celebration/tray; edits to a *past* day only
  // persist and refresh history — they never touch the reminder loop.
  ipcMain.handle('water:add', (e, payload) => {
    const p = payload && typeof payload === 'object' ? payload : { ml: payload, kind: 'custom' };
    const key = p.dateKey || dateKey();
    const isToday = key === dateKey();
    const prev = isToday ? store.getToday().totalMl : 0;
    const day = store.addWater(p.ml, p.kind, { dateKey: key, ts: p.ts });
    if (isToday) {
      if (scheduler) scheduler.noteActivity();
      maybeCelebrate(prev, day);
      updateTrayTooltip(day);
    }
    refreshOthers(e.sender); // keep the other window (main <-> widget) in sync
    return day;
  });

  ipcMain.handle('water:undo', (e) => {
    const day = store.undoLast();
    updateTrayTooltip(day);
    refreshOthers(e.sender);
    return day;
  });

  ipcMain.handle('water:remove', (e, arg) => {
    const id = arg && typeof arg === 'object' ? arg.id : arg;
    const key = (arg && typeof arg === 'object' && arg.dateKey) || dateKey();
    const day = store.removeEntry(id, key);
    if (key === dateKey()) updateTrayTooltip(day);
    refreshOthers(e.sender);
    return day;
  });

  ipcMain.handle('entry:edit', (e, { id, patch, dateKey: key }) => {
    const k = key || dateKey();
    const day = store.editEntry(id, patch || {}, k);
    if (k === dateKey()) updateTrayTooltip(day);
    refreshOthers(e.sender);
    return day;
  });

  ipcMain.handle('day:get', (_e, key) => store.getDay(key || dateKey()));

  ipcMain.handle('app:show', () => showWindow(true));

  // Widget dragging is computed entirely in the main process using screen
  // coordinates (DIP), so it never mixes renderer physical px with DIP the way
  // the old getPos/setPos did — that mismatch made the window chase the cursor
  // on scaled displays and catch an edge-resize.
  ipcMain.handle('widget:dragStart', () => {
    if (!widgetWindow || widgetWindow.isDestroyed()) return;
    const c = screen.getCursorScreenPoint();
    const [wx, wy] = widgetWindow.getPosition();
    widgetDrag = { dx: c.x - wx, dy: c.y - wy };
  });

  ipcMain.on('widget:dragMove', () => {
    if (!widgetWindow || widgetWindow.isDestroyed() || !widgetDrag) return;
    const c = screen.getCursorScreenPoint();
    const pos = clampToScreen(c.x - widgetDrag.dx, c.y - widgetDrag.dy);
    // Use setBounds with an explicit size, NOT setPosition: on fractional-DPI
    // displays a transparent window grows a pixel or two every time it's moved
    // via setPosition (Electron #10862). Re-asserting the size each move stops it.
    widgetWindow.setBounds({ x: pos.x, y: pos.y, width: WIDGET_W, height: WIDGET_H });
  });

  ipcMain.handle('widget:dragEnd', () => {
    widgetDrag = null;
    scheduleWidgetSave();
  });

  ipcMain.handle('settings:update', (e, partial) => {
    const settings = store.updateSettings(partial || {});
    if (partial && 'theme' in partial) {
      applyTheme(settings.theme);
      syncTitleBarOverlay();
      broadcastTheme();
    }
    if (partial && 'launchOnStartup' in partial) {
      app.setLoginItemSettings({ openAtLogin: !!settings.launchOnStartup, args: ['--opened-at-login'] });
    }
    if (partial && ('remindersEnabled' in partial || 'reminderIntervalMin' in partial)) {
      if (scheduler) scheduler.noteActivity(); // reset the interval anchor + re-arm
    } else if (partial && 'quietHours' in partial) {
      if (scheduler) scheduler.reschedule(); // quiet-window edges moved
    }
    if (partial && 'widgetEnabled' in partial) {
      setWidgetEnabled(settings.widgetEnabled);
      rebuildTray();
    }
    // Goal/bottle changes affect the widget's readout too.
    refreshOthers(e.sender);
    rebuildTray();
    updateTrayTooltip();
    return settings;
  });

  ipcMain.handle('history:get', (_e, nDays) => store.getHistory(nDays || 30));

  ipcMain.handle('export:run', (e, payload) => runExport(e, payload || {}));
}

// ---------------------------------------------------------------------------
// Export (CSV / JSON / printable PDF)
// ---------------------------------------------------------------------------
function rangeStartKey(range, state, toKey) {
  if (range === 'all') return report.earliestKey(state);
  const n = range === '7' ? 6 : 29;
  const [y, m, d] = toKey.split('-').map(Number);
  return report.keyOf(new Date(y, m - 1, d - n));
}
function rangeLabel(range) {
  return range === 'all' ? 'All time' : range === '7' ? 'Last 7 days' : 'Last 30 days';
}
function exportFileMeta(format, toKey) {
  if (format === 'csv') return { defaultPath: `waterline-${toKey}.csv`, filters: [{ name: 'CSV', extensions: ['csv'] }] };
  if (format === 'json') return { defaultPath: `waterline-backup-${toKey}.json`, filters: [{ name: 'JSON', extensions: ['json'] }] };
  return { defaultPath: `waterline-report-${toKey}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] };
}

/** Render report HTML to PDF via a hidden window + printToPDF. */
async function renderPdf(html) {
  const tmp = path.join(app.getPath('temp'), `waterline-report-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
  try {
    await win.loadFile(tmp);
    return await win.webContents.printToPDF({ printBackground: true });
  } finally {
    win.destroy();
    try { fs.unlinkSync(tmp); } catch (_) { /* best effort */ }
  }
}

async function runExport(e, { format = 'pdf', range = 'all' }) {
  const state = store.getState();
  const toKey = dateKey();
  const fromKey = rangeStartKey(range, state, toKey);
  const meta = exportFileMeta(format, toKey);
  const host = BrowserWindow.fromWebContents(e.sender) || mainWindow;
  const { canceled, filePath } = await dialog.showSaveDialog(host, {
    title: 'Export Waterline data',
    defaultPath: meta.defaultPath,
    filters: meta.filters,
  });
  if (canceled || !filePath) return { ok: false, canceled: true };
  try {
    if (format === 'csv') {
      fs.writeFileSync(filePath, report.toCSV(report.collectRange(state, fromKey, toKey).days), 'utf8');
    } else if (format === 'json') {
      fs.writeFileSync(filePath, report.toJSON(state), 'utf8');
    } else {
      const { days, stats } = report.collectRange(state, fromKey, toKey);
      const html = report.toHTML({ days, stats, rangeLabel: rangeLabel(range), generatedAt: new Date().toLocaleString() });
      fs.writeFileSync(filePath, await renderPdf(html));
    }
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

function broadcastTheme() {
  const t = resolvedTheme();
  for (const w of liveWindows()) w.webContents.send('theme:changed', t);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow(true));

  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    if (process.env.WATERLINE_USERDATA) app.setPath('userData', process.env.WATERLINE_USERDATA);
    store = new Store(path.join(app.getPath('userData'), 'waterline.json'));

    applyTheme(store.getSettings().theme);
    app.setLoginItemSettings({
      openAtLogin: !!store.getSettings().launchOnStartup,
      args: ['--opened-at-login'],
    });

    registerIpc();
    createWindow();
    createTray();
    scheduler = buildScheduler();
    scheduler.start();
    if (store.getSettings().widgetEnabled) createWidget();

    nativeTheme.on('updated', () => {
      syncTitleBarOverlay();
      broadcastTheme();
    });

    powerMonitor.on('resume', () => {
      checkDayRollover();
      if (scheduler) scheduler.reschedule(); // recompute after the clock jumped
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else showWindow();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('window-all-closed', () => {
    // "Keep running in tray when closed" keeps us alive; otherwise closing
    // the last window quits like a normal app.
    if (store && !store.getSettings().closeToTray) {
      isQuitting = true;
      app.quit();
    }
  });
}
