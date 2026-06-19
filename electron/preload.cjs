// Rockmundo - Electron preload (Phase 1)
// Minimal, secure bridge. Steamworks IPC will be added in Phase 2.

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('rockmundo', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
});
