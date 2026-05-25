const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  getTelegramConfig: () => ipcRenderer.invoke('get-telegram-config'),
  saveTelegramConfig: (config) => ipcRenderer.invoke('save-telegram-config', config),
  
  listTriageFiles: () => ipcRenderer.invoke('list-triage-files'),
  processTriageFile: (payload) => ipcRenderer.invoke('process-triage-file', payload),
  
  browseDirs: (path) => ipcRenderer.invoke('browse-dirs', path),
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openDirectoryDialog: () => ipcRenderer.invoke('open-directory-dialog'),
  
  validateAccess: (payload) => ipcRenderer.invoke('validate-access', payload),
  
  previewAutomation: () => ipcRenderer.invoke('preview-automation'),
  testTelegram: (payload) => ipcRenderer.invoke('test-telegram', payload),
  
  runAutomation: (project) => ipcRenderer.invoke('run-automation', project),
  onAutomationLog: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('automation-log', subscription);
    return () => ipcRenderer.removeListener('automation-log', subscription);
  }
});
