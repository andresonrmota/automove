// Cliente API para encapsular chamadas IPC no Frontend

export async function getSettings() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getSettings();
  }
  // Fallback para desenvolvimento web puro se necessário
  const res = await fetch('/api/settings');
  return res.json();
}

export async function saveSettings(settings: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.saveSettings(settings);
  }
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export async function getTelegramConfig() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getTelegramConfig();
  }
  const res = await fetch('/api/settings/telegram');
  return res.json();
}

export async function saveTelegramConfig(config: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.saveTelegramConfig(config);
  }
  const res = await fetch('/api/settings/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function listTriageFiles() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.listTriageFiles();
  }
  const res = await fetch('/api/triage');
  return res.json();
}

export async function processTriageFile(payload: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.processTriageFile(payload);
  }
  const res = await fetch('/api/triage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function browseDirs(pathStr?: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.browseDirs(pathStr);
  }
  const url = pathStr ? `/api/browse?path=${encodeURIComponent(pathStr)}` : '/api/browse';
  const res = await fetch(url);
  return res.json();
}

export async function getHomeDir() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.getHomeDir();
  }
  const res = await fetch('/api/browse');
  const data = await res.json();
  return data.current;
}

export async function openFolder(folderPath: string) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.openFolder(folderPath);
  }
  const res = await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folderPath }),
  });
  return res.json();
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
  const res = await fetch('/api/validate-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function previewAutomation() {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.previewAutomation();
  }
  const res = await fetch('/api/automation/preview');
  return res.json();
}

export async function testTelegram(payload: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.testTelegram(payload);
  }
  const res = await fetch('/api/settings/telegram/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function runAutomation(project: any) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.runAutomation(project);
  }
  // No caso web legado, a automação retorna um Stream. No Electron, ela resolve via IPC.
  const res = await fetch('/api/automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  return res;
}

export function onAutomationLog(callback: (data: any) => void) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI.onAutomationLog(callback);
  }
  // Web fallback (vazio)
  return () => {};
}
