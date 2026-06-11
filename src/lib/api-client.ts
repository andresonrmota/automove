// Cliente API para encapsular chamadas IPC no Frontend

async function safeFetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    if (res.headers.get('content-type')?.includes('text/html')) {
      throw new Error("Modo Web não suportado. Por favor, utilize o aplicativo Desktop (Electron).");
    }
    throw new Error(`Erro na API (${res.status})`);
  }
  if (res.headers.get('content-type')?.includes('text/html')) {
    throw new Error("Modo Web não suportado. Por favor, utilize o aplicativo Desktop (Electron).");
  }
  return res.json();
}

export async function getSettings() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getSettings();
  }
  // Fallback para desenvolvimento web puro se necessário
  return safeFetchJson('/api/settings');
}

export async function saveSettings(settings: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.saveSettings(settings);
  }
  return safeFetchJson('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export async function getTelegramConfig() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getTelegramConfig();
  }
  return safeFetchJson('/api/settings/telegram');
}

export async function saveTelegramConfig(config: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.saveTelegramConfig(config);
  }
  return safeFetchJson('/api/settings/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
}

export async function listTriageFiles() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.listTriageFiles();
  }
  return safeFetchJson('/api/triage');
}

export async function processTriageFile(payload: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.processTriageFile(payload);
  }
  return safeFetchJson('/api/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function openFilePath(filePath: string) {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openFilePath) {
    return window.electronAPI.openFilePath(filePath);
  }
  return { success: false, error: 'Apenas para ambiente Desktop' };
}

export async function showItemInFolder(filePath: string) {
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.showItemInFolder) {
    return window.electronAPI.showItemInFolder(filePath);
  }
  return { success: false, error: 'Apenas para ambiente Desktop' };
}

export async function browseDirs(pathStr?: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.browseDirs(pathStr);
  }
  const url = pathStr ? `/api/browse?path=${encodeURIComponent(pathStr)}` : '/api/browse';
  return safeFetchJson(url);
}

export async function getHomeDir() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getHomeDir();
  }
  const data = await safeFetchJson('/api/browse');
  return data.current;
}

export async function openFolder(folderPath: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.openFolder(folderPath);
  }
  return safeFetchJson('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath }),
  });
}

export async function openDirectoryDialog() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.openDirectoryDialog();
  }
  return { canceled: true };
}

export async function validateAccess(payload: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.validateAccess(payload);
  }
  return safeFetchJson('/api/validate-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function previewAutomation() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.previewAutomation();
  }
  return safeFetchJson('/api/automation/preview');
}

export async function testTelegram(payload: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.testTelegram(payload);
  }
  return safeFetchJson('/api/settings/telegram/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function runAutomation(project: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.runAutomation(project);
  }
  // No caso web legado, a automação retorna um Stream. No Electron, ela resolve via IPC.
  return fetch('/api/automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
}

export function onAutomationLog(callback: (data: any) => void) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.onAutomationLog(callback);
  }
  // Web fallback (vazio)
  return () => {};
}

export async function exportSettings(password: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.exportSettings(password);
  }
  return { success: false, error: 'Funcionalidade apenas para Desktop' };
}

export async function importSettings(password: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.importSettings(password);
  }
  return { success: false, error: 'Funcionalidade apenas para Desktop' };
}
