import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PENDING_DIR = path.join(process.cwd(), 'uploads', 'pending');

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('file');

  if (!file) return new Response('Arquivo não especificado', { status: 400 });

  const filePath = path.join(PENDING_DIR, file);

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
