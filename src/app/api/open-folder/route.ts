import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { folderPath } = await req.json();

    if (!folderPath || typeof folderPath !== 'string') {
      return NextResponse.json({ error: 'Caminho inválido.' }, { status: 400 });
    }

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

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Não foi possível abrir a pasta.' }, { status: 500 });
  }
}
