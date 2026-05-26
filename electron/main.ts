import { app, BrowserWindow, ipcMain, protocol, net, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { pathToFileURL } from 'url';
import { exec } from 'child_process';
import { chromium } from 'playwright';

// Importar funções de configuração e automação
import {
  getFolderConfig,
  saveFolderConfig,
  getProjects,
  saveProjects,
  getAccessConfig,
  saveAccessConfig,
  FolderConfig,
  Project,
  AccessConfig
} from '../src/lib/config';

import { getTelegramConfig, saveTelegramConfig, TelegramConfig } from '../src/lib/env-config';
import { runMoveAutomation } from '../src/lib/automation/move-bot';

// Registrar protocolos customizados antes da app estar pronta
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'safe-file', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'AutoMove Desktop',
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL('app://local');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Configurar protocolos customizados
function registerProtocols() {
  // Protocolo 'app' para servir o Next.js exportado
  protocol.handle('app', async (request) => {
    try {
      const url = new URL(request.url);
      let pathname = url.pathname;

      // Resolver o caminho estático (out/ no root do projeto)
      let filePath = path.join(__dirname, '..', 'out', pathname);

      if (pathname === '' || pathname === '/') {
        filePath = path.join(__dirname, '..', 'out', 'index.html');
      } else if (!fs.existsSync(filePath)) {
        // Tentar com .html caso seja uma rota estática do Next (ex: /settings -> /settings.html)
        if (fs.existsSync(filePath + '.html')) {
          filePath += '.html';
        } else {
          // Fallback para index.html para suportar rotas de SPA/Client-side
          filePath = path.join(__dirname, '..', 'out', 'index.html');
        }
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('Erro no protocolo app://', err);
      return new Response('Erro interno do app', { status: 500 });
    }
  });

  // Protocolo 'safe-file' para servir imagens e PDFs locais de forma segura
  protocol.handle('safe-file', async (request) => {
    try {
      const url = new URL(request.url);
      const folderType = url.hostname; // 'base', 'triados', 'concluidos'
      const fileName = decodeURIComponent(url.pathname.slice(1));

      const folders = getFolderConfig();
      let baseDir = folders.baseFolder;

      if (!baseDir) {
        return new Response('Pasta não configurada', { status: 400 });
      }

      if (folderType === 'triados') baseDir = path.join(baseDir, 'Triados');
      if (folderType === 'concluidos') baseDir = path.join(baseDir, 'Processados');

      const filePath = path.join(baseDir, fileName);
      if (!fs.existsSync(filePath)) {
        return new Response('Arquivo não encontrado', { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('Erro no protocolo safe-file://', err);
      return new Response('Erro ao carregar arquivo local', { status: 500 });
    }
  });
}

app.whenReady().then(() => {
  registerProtocols();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// --- IPC HANDLERS ---

// 1. Configurações (Settings)
ipcMain.handle('get-settings', () => {
  const folders = getFolderConfig();
  const projects = getProjects();
  const access = getAccessConfig();
  return { folders, projects, access };
});

ipcMain.handle('save-settings', (event, data: { folders?: FolderConfig; projects?: Project[]; access?: AccessConfig }) => {
  try {
    if (data.folders) {
      // Garantir criação das pastas
      if (data.folders.baseFolder && !fs.existsSync(data.folders.baseFolder)) {
        fs.mkdirSync(data.folders.baseFolder, { recursive: true });
      }
      saveFolderConfig(data.folders);
    }
    if (data.projects !== undefined) {
      saveProjects(data.projects);
    }
    if (data.access !== undefined) {
      saveAccessConfig(data.access);
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao salvar configurações.' };
  }
});

// 2. Telegram Config
ipcMain.handle('get-telegram-config', () => {
  return getTelegramConfig();
});

ipcMain.handle('save-telegram-config', (event, config: TelegramConfig) => {
  try {
    saveTelegramConfig(config);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao salvar configurações do Telegram.' };
  }
});

// 3. Triagem (Triage)
ipcMain.handle('list-triage-files', () => {
  try {
    const { baseFolder } = getFolderConfig();
    if (!baseFolder || !fs.existsSync(baseFolder)) {
      return { files: [] };
    }

    const files = fs.readdirSync(baseFolder, { withFileTypes: true }).filter(dirent => {
      if (dirent.isDirectory()) return false;
      const f = dirent.name.toLowerCase();
      return !f.startsWith('.') &&
        (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.pdf'));
    });

    const fileDetails = files.map(dirent => {
      const filePath = path.join(baseFolder, dirent.name);
      const stats = fs.statSync(filePath);
      return {
        name: dirent.name,
        size: stats.size,
        // Usar protocolo safe-file:// em vez de rota da API
        path: `safe-file://base/${encodeURIComponent(dirent.name)}`
      };
    });

    return { files: fileDetails };
  } catch (err: any) {
    return { error: err.message || 'Erro ao listar arquivos pendentes' };
  }
});

ipcMain.handle('process-triage-file', async (event, data: { originalName: string; type: string; date: string; value: string }) => {
  try {
    const { baseFolder } = getFolderConfig();
    if (!baseFolder) throw new Error('Pasta Base não configurada');

    const triados = path.join(baseFolder, 'Triados');
    if (!fs.existsSync(triados)) {
      fs.mkdirSync(triados, { recursive: true });
    }

    const { originalName, type, date, value } = data;

    const parts = date.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2].substring(2, 4);
    const formattedDate = `${day}${month}${year}`;

    const numericValue = value.replace(',', '').replace('.', '').padStart(5, '0');

    const extension = path.extname(originalName);
    const newName = `${type}${formattedDate}${numericValue}${originalName.replace(extension, '')}${extension}`;

    const oldPath = path.join(baseFolder, originalName);
    const newPath = path.join(triados, newName);

    fs.renameSync(oldPath, newPath);

    return { success: true, newName };
  } catch (err: any) {
    return { error: err.message || 'Erro ao processar arquivo' };
  }
});

ipcMain.handle('open-directory-dialog', async () => {
  if (!mainWindow) return { error: 'Janela principal não encontrada' };

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const selectedPath = result.filePaths[0];

  // Auto-criar subpastas
  const triadosPath = path.join(selectedPath, 'Triados');
  const processadosPath = path.join(selectedPath, 'Processados');
  
  if (!fs.existsSync(triadosPath)) fs.mkdirSync(triadosPath, { recursive: true });
  if (!fs.existsSync(processadosPath)) fs.mkdirSync(processadosPath, { recursive: true });

  // Salvar a pasta Base nas configurações
  saveFolderConfig({ baseFolder: selectedPath });

  return { canceled: false, path: selectedPath };
});

// 4. File Picker / Browse
ipcMain.handle('browse-dirs', async (event, requestedPath?: string) => {
  const targetPath = requestedPath || os.homedir();
  const normalizedPath = path.normalize(targetPath);

  try {
    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return { error: 'Não é um diretório.' };
    }

    const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const parent = normalizedPath !== path.parse(normalizedPath).root
      ? path.dirname(normalizedPath)
      : null;

    return {
      current: normalizedPath,
      parent,
      dirs,
    };
  } catch (err: any) {
    return { error: err.message || 'Caminho inválido ou sem permissão.' };
  }
});

ipcMain.handle('get-home-dir', () => {
  return os.homedir();
});

// 5. Open Folder
ipcMain.handle('open-folder', async (event, folderPath: string) => {
  try {
    const normalized = path.normalize(folderPath);
    if (!fs.existsSync(normalized)) {
      fs.mkdirSync(normalized, { recursive: true });
    }

    const platform = process.platform;
    const cmd =
      platform === 'darwin' ? `open "${normalized}"` :
      platform === 'win32'  ? `explorer "${normalized}"` :
                              `xdg-open "${normalized}"`;

    exec(cmd);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'Não foi possível abrir a pasta.' };
  }
});

// 6. Validar Acesso MOVE (Playwright)
ipcMain.handle('validate-access', async (event, data: { user: string; pass: string; client: string }) => {
  const { user, pass, client } = data;

  if (!user || !pass || !client) {
    return { success: false, error: 'Preencha todos os campos antes de validar.' };
  }

  let browser;
  try {
    const launchOptions: any = { headless: true, slowMo: 30 };
    if (process.platform === 'win32') {
      if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe') || 
          fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')) {
        launchOptions.channel = 'chrome';
      } else if (fs.existsSync('C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe') || 
                 fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
        launchOptions.channel = 'msedge';
      }
    }
    browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto('https://move.mv.com.br/', { waitUntil: 'networkidle', timeout: 20000 });

    const userField = page.locator('input.MuiOutlinedInput-input').nth(0);
    await userField.waitFor({ state: 'visible', timeout: 10000 });
    await userField.fill(user);

    const passField = page.locator('input[type="password"]');
    await passField.fill(pass);

    const companySelect = page.locator('#demo-simple-select-outlined');
    if (await companySelect.isVisible()) {
      await companySelect.click();
      const option = page.locator(`li[role="option"]:has-text("${client}")`);
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    }

    await page.locator('button.MuiButton-contained').click();

    const outcome = await Promise.race([
      page.waitForURL('**/site**', { timeout: 15000 }).then(() => 'success' as const),
      page.waitForSelector('text="Usuário ou senha inválidos"', { timeout: 15000 }).then(() => 'invalid' as const),
    ]).catch(() => 'timeout' as const);

    await browser.close();

    if (outcome === 'success') {
      return { success: true };
    } else if (outcome === 'invalid') {
      return { success: false, error: 'Usuário ou senha inválidos no portal MOVE.' };
    } else {
      return { success: false, error: 'Portal MOVE não respondeu. Verifique sua conexão.' };
    }
  } catch (err: any) {
    if (browser) await browser.close();
    return { success: false, error: err.message || 'Erro ao tentar conectar ao portal MOVE.' };
  }
});

// 7. Preview da Automação (Arquivos Triados)
ipcMain.handle('preview-automation', async () => {
  try {
    const { baseFolder } = getFolderConfig();
    if (!baseFolder) return { items: [] };

    const triados = path.join(baseFolder, 'Triados');

    if (!fs.existsSync(triados)) {
      return { items: [] };
    }

    const files = fs.readdirSync(triados).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.pdf', '.heic', '.webp'].includes(ext);
    });

    const currentYear = new Date().getFullYear();
    const TYPE_MAP: Record<string, string> = {
      AL: 'Alimentação',
      BG: 'Bagagem',
      CB: 'Combustível',
      ES: 'Estacionamento',
      LV: 'Lavanderia',
      PG: 'Pedágio',
      TA: 'Taxi APP',
      TU: 'Transportes Urbanos',
    };

    const items = files.map(fileName => {
      try {
        const typeChar = fileName.substring(0, 2).toUpperCase();
        const dayStr = fileName.substring(2, 4);
        const monthStr = fileName.substring(4, 6);
        const yearStr = fileName.substring(6, 8);
        const rawValue = fileName.substring(8, 13);

        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const valueInteger = parseInt(rawValue.substring(0, 3), 10);
        const valueCents = rawValue.substring(3, 5);
        const valueNumeric = parseFloat(`${valueInteger}.${valueCents}`);

        const type = TYPE_MAP[typeChar] ?? 'Outro';
        const fullYear = parseInt(`20${yearStr}`, 10);
        const date = `${dayStr}/${monthStr}/${isNaN(fullYear) ? currentYear : fullYear}`;
        const value = valueNumeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (isNaN(day) || isNaN(month) || isNaN(valueNumeric)) {
          return { fileName, error: true };
        }

        return { fileName, type, date, value };
      } catch {
        return { fileName, error: true };
      }
    });

    items.sort((a, b) => {
      if (a.error || b.error) return 0;
      const dayA = parseInt(a.date!.substring(0, 2));
      const monthA = parseInt(a.date!.substring(3, 5));
      const dayB = parseInt(b.date!.substring(0, 2));
      const monthB = parseInt(b.date!.substring(3, 5));
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    return { items };
  } catch (err: any) {
    return { error: err.message || 'Erro ao ler pasta Triados.' };
  }
});

// 8. Testar Integração do Telegram
ipcMain.handle('test-telegram', async (event, data: { botToken: string; chatId: string }) => {
  try {
    const { botToken, chatId } = data;
    const config = getTelegramConfig();
    const finalToken = botToken || config.botToken;
    const finalChatId = chatId || config.chatId;

    if (!finalToken || !finalChatId) {
      return { success: false, error: 'Token ou Chat ID não informados.' };
    }

    const message = `🤖 *AutoMove Teste*\n\nSua integração com o Telegram está funcionando perfeitamente! ✅`;
    const url = `https://api.telegram.org/bot${finalToken}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: finalChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Erro do Telegram: ${errorText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao tentar conectar ao Telegram.' };
  }
});

// 9. Rodar Automação (Playwright com logs por IPC)
ipcMain.handle('run-automation', async (event, project: any) => {
  try {
    const telegramConfig = getTelegramConfig();
    process.env.TELEGRAM_ENABLED = String(telegramConfig.enabled);
    process.env.TELEGRAM_BOT_TOKEN = telegramConfig.botToken;
    process.env.TELEGRAM_CHAT_ID = telegramConfig.chatId;

    const result = await runMoveAutomation(project, (msg: any) => {
      if (mainWindow) {
        mainWindow.webContents.send('automation-log', msg);
      }
    });

    return { ...result, success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro fatal na automação.' };
  }
});
