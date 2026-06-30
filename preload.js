const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data) => ipcRenderer.invoke('data:save', data),
  readPhoto: (filename) => ipcRenderer.invoke('photo:read', filename),
  importPhoto: () => ipcRenderer.invoke('photo:import'),
  importPhotoPath: (path) => ipcRenderer.invoke('photo:importPath', path)
});
