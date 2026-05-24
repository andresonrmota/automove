import { NextResponse } from 'next/server';
import fs from 'fs';
import { getFolderConfig, saveFolderConfig, getProjects, saveProjects, getAccessConfig, saveAccessConfig, FolderConfig, Project, AccessConfig } from '@/lib/config';

export async function GET() {
  const folders = getFolderConfig();
  const projects = getProjects();
  const access = getAccessConfig();
  return NextResponse.json({ folders, projects, access });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.folders) {
      const folders = body.folders as FolderConfig;
      const errors: string[] = [];
      for (const [key, folderPath] of Object.entries(folders)) {
        if (!folderPath) { errors.push(`Pasta "${key}" não informada.`); continue; }
        if (!fs.existsSync(folderPath as string)) {
          try { fs.mkdirSync(folderPath as string, { recursive: true }); }
          catch { errors.push(`Não foi possível criar a pasta "${key}": ${folderPath}`); }
        }
      }
      if (errors.length > 0) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
      saveFolderConfig(folders);
    }

    if (body.projects !== undefined) {
      saveProjects(body.projects as Project[]);
    }

    if (body.access !== undefined) {
      saveAccessConfig(body.access as AccessConfig);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar configurações.' }, { status: 500 });
  }
}
