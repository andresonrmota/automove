import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.automove', 'config.json');

export interface FolderConfig {
  baseFolder: string;
}

export interface Project {
  id: string;
  name: string;
  international: boolean;
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

function readConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // fallback silencioso
  }
  return { folders: { ...EMPTY_FOLDERS }, projects: [], access: { ...EMPTY_ACCESS } };
}

function writeConfig(config: AppConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

export function getFolderConfig(): FolderConfig {
  return { ...EMPTY_FOLDERS, ...readConfig().folders };
}

export function saveFolderConfig(folders: FolderConfig): void {
  const config = readConfig();
  writeConfig({ ...config, folders });
}

export function getProjects(): Project[] {
  return readConfig().projects ?? [];
}

export function saveProjects(projects: Project[]): void {
  const config = readConfig();
  writeConfig({ ...config, projects });
}

export function getAccessConfig(): AccessConfig {
  return { ...EMPTY_ACCESS, ...readConfig().access };
}

export function saveAccessConfig(access: AccessConfig): void {
  const config = readConfig();
  writeConfig({ ...config, access });
}

export function isFolderConfigComplete(config: FolderConfig): boolean {
  return !!config.baseFolder;
}

export function getHomeDir(): string {
  return os.homedir();
}
