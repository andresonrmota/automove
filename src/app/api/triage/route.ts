import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getFolderConfig } from '@/lib/config';

export async function GET() {
  try {
    const { novos } = getFolderConfig();
    if (!fs.existsSync(novos)) fs.mkdirSync(novos, { recursive: true });

    const files = fs.readdirSync(novos).filter(f =>
      !f.startsWith('.') &&
      (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.pdf'))
    );

    const fileDetails = files.map(file => {
      const filePath = path.join(novos, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        path: `/api/triage/image?file=${encodeURIComponent(file)}`
      };
    });

    return NextResponse.json({ files: fileDetails });
  } catch {
    return NextResponse.json({ error: 'Erro ao listar arquivos pendentes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { novos, triados } = getFolderConfig();
    if (!fs.existsSync(triados)) fs.mkdirSync(triados, { recursive: true });

    const { originalName, type, date, value } = await req.json();

    const parts = date.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const formattedDate = `${day}${month}`;

    const numericValue = value.replace(',', '').replace('.', '').padStart(5, '0');

    const extension = path.extname(originalName);
    const newName = `${type}${formattedDate}${numericValue}${originalName.replace(extension, '')}${extension}`;

    const oldPath = path.join(novos, originalName);
    const newPath = path.join(triados, newName);

    fs.renameSync(oldPath, newPath);

    return NextResponse.json({ success: true, newName });
  } catch {
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 });
  }
}
