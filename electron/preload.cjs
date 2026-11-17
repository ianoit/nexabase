const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onAction: (callback) => ipcRenderer.on('action', (_event, value) => callback(value)),
});
