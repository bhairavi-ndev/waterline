'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe, minimal API surface exposed to the renderer.
 * The renderer never touches Node/Electron internals directly.
 */
contextBridge.exposeInMainWorld('hydrate', {
  getState: () => ipcRenderer.invoke('app:getState'),
  addWater: (ml, kind, opts = {}) => ipcRenderer.invoke('water:add', { ml, kind, dateKey: opts.dateKey, ts: opts.ts }),
  undoLast: () => ipcRenderer.invoke('water:undo'),
  removeEntry: (id, dateKey) => ipcRenderer.invoke('water:remove', { id, dateKey }),
  editEntry: (id, patch, dateKey) => ipcRenderer.invoke('entry:edit', { id, patch, dateKey }),
  getDay: (dateKey) => ipcRenderer.invoke('day:get', dateKey),
  updateSettings: (partial) => ipcRenderer.invoke('settings:update', partial),
  getHistory: (nDays) => ipcRenderer.invoke('history:get', nDays),
  exportReport: (format, range) => ipcRenderer.invoke('export:run', { format, range }),

  // Widget-only controls (no-ops from the main window).
  openApp: () => ipcRenderer.invoke('app:show'),
  widgetDragStart: () => ipcRenderer.invoke('widget:dragStart'),
  widgetDragMove: () => ipcRenderer.send('widget:dragMove'),
  widgetDragEnd: () => ipcRenderer.invoke('widget:dragEnd'),

  // Push events from main -> renderer.
  onRefresh: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('today:refresh', listener);
    return () => ipcRenderer.removeListener('today:refresh', listener);
  },
  onThemeChanged: (cb) => {
    const listener = (_e, theme) => cb(theme);
    ipcRenderer.on('theme:changed', listener);
    return () => ipcRenderer.removeListener('theme:changed', listener);
  },
  onNavToday: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('nav:today', listener);
    return () => ipcRenderer.removeListener('nav:today', listener);
  },
});
