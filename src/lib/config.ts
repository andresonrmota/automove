import fs from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { safeStorage } from 'electron';

const CONFIG_PATH = path.join(os.homedir(), '.automove', 'config.json');

// Prefixo que marca um valor criptografado pelo safeStorage (base64)
const ENC_PREFIX = 'enc:';

export interface FolderConfig {
  baseFolder: string;
}

export interface Project {
  id: string;
  name: string;
  international: boolean;
  inactiveDate?: string;
}

export interface AccessConfig {
  user: string;
  pass: string;
  client: string;
  headless: boolean;
}

export interface AppConfig {
  folders: FolderConfig;
  projects: Project[];
  access: AccessConfig;
}

const EMPTY_FOLDERS: FolderConfig = { baseFolder: '' };

const EMPTY_ACCESS: AccessConfig = { user: '', pass: '', client: '', headless: true };

// Cache em memória — invalidado apenas nas escritas
let cachedConfig: AppConfig | null = null;

function encryptPass(plainPass: string): string {
  if (!plainPass) return plainPass;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return ENC_PREFIX + safeStorage.encryptString(plainPass).toString('base64');
    }
  } catch {
    // ambiente sem suporte — mantém em texto plano
  }
  return plainPass;
}

function decryptPass(storedPass: string): string {
  if (!storedPass || !storedPass.startsWith(ENC_PREFIX)) return storedPass;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(storedPass.slice(ENC_PREFIX.length), 'base64'));
    }
  } catch {
    // chave do keychain indisponível ou valor corrompido
  }
  return '';
}

async function readConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const raw = await fsp.readFile(CONFIG_PATH, 'utf-8');
    cachedConfig = JSON.parse(raw);
    return cachedConfig!;
  } catch {
    // arquivo inexistente ou corrompido — fallback silencioso
  }
  cachedConfig = { folders: { ...EMPTY_FOLDERS }, projects: [], access: { ...EMPTY_ACCESS } };
  return cachedConfig;
}

async function writeConfig(config: AppConfig): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  cachedConfig = config;
}

export async function getFolderConfig(): Promise<FolderConfig> {
  return { ...EMPTY_FOLDERS, ...(await readConfig()).folders };
}

export async function saveFolderConfig(folders: FolderConfig): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, folders });
}

export async function getProjects(): Promise<Project[]> {
  return (await readConfig()).projects ?? [];
}

export async function saveProjects(projects: Project[]): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, projects });
}

export async function getAccessConfig(): Promise<AccessConfig> {
  const access = { ...EMPTY_ACCESS, ...(await readConfig()).access };
  return { ...access, pass: decryptPass(access.pass) };
}

export async function saveAccessConfig(access: AccessConfig): Promise<void> {
  const config = await readConfig();
  await writeConfig({ ...config, access: { ...access, pass: encryptPass(access.pass) } });
}

export function isFolderConfigComplete(config: FolderConfig): boolean {
  return !!config.baseFolder;
}

export function getHomeDir(): string {
  return os.homedir();
}
