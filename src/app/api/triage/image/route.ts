import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getFolderConfig } from '@/lib/config';

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get('file');

  if (!file) return new Response('Arquivo não especificado', { status: 400 });

  const { novos } = getFolderConfig();
  const filePath = path.join(novos, file);

  if (!fs.existsSync(filePath)) return new Response('Arquivo não encontrado', { status: 404 });

  const fileBuffer = fs.readFileSync(filePath);
  const extension = path.extname(file).toLowerCase();
  
  let contentType = 'application/octet-stream';
  if (extension === '.jpg' || extension === '.jpeg') contentType = 'image/jpeg';
  else if (extension === '.png') contentType = 'image/png';
  else if (extension === '.pdf') contentType = 'application/pdf';

  return new Response(fileBuffer, {
    headers: {
      'Content-Type': contentType,
    },
  });
}
