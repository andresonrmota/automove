import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getHomeDir } from '@/lib/config';

export async function GET(req: NextRequest) {
  const requestedPath = req.nextUrl.searchParams.get('path') || getHomeDir();

  // Normalizar e garantir que é um path absoluto válido
  const normalizedPath = path.normalize(requestedPath);

  try {
    const stat = fs.statSync(normalizedPath);
    if (!stat.isDirectory()) {
      return NextResponse.json({ error: 'Não é um diretório.' }, { status: 400 });
    }

    const entries = fs.readdirSync(normalizedPath, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const parent = normalizedPath !== path.parse(normalizedPath).root
      ? path.dirname(normalizedPath)
      : null;

    return NextResponse.json({
      current: normalizedPath,
      parent,
      dirs,
    });
  } catch {
    return NextResponse.json({ error: 'Caminho inválido ou sem permissão de leitura.' }, { status: 400 });
  }
}
