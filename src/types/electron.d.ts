export interface ElectronAPI {
  getSettings: () => Promise<{ folders: any; projects: any; access: any }>;
  saveSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;
  getTelegramConfig: () => Promise<any>;
  saveTelegramConfig: (config: any) => Promise<{ success: boolean; error?: string }>;
  
  listTriageFiles: () => Promise<{ files?: any[]; error?: string }>;
  processTriageFile: (payload: any) => Promise<{ success: boolean; newName?: string; error?: string }>;
  
  browseDirs: (path?: string) => Promise<any>;
  getHomeDir: () => Promise<string>;
  openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
  openDirectoryDialog: () => Promise<{ canceled: boolean; path?: string; error?: string }>;
  
  validateAccess: (payload: any) => Promise<{ success: boolean; error?: string }>;
  
  previewAutomation: () => Promise<{ items: any[]; error?: string }>;
  testTelegram: (payload: any) => Promise<{ success: boolean; error?: string }>;
  
  runAutomation: (project: any) => Promise<any>;
  onAutomationLog: (callback: (data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
