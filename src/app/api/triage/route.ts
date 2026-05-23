import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const PENDING_DIR = path.join(process.cwd(), 'uploads', 'pending');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

// Garantir que as pastas existam
if (!fs.existsSync(PENDING_DIR)) fs.mkdirSync(PENDING_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export async function GET() {
  try {
    const files = fs.readdirSync(PENDING_DIR).filter(f => 
      !f.startsWith('.') && 
      (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png') || f.toLowerCase().endsWith('.pdf'))
    );

    const fileDetails = files.map(file => {
      const filePath = path.join(PENDING_DIR, file);
      const stats = fs.statSync(filePath);
      // Para o Next.js exibir a imagem, precisamos convertê-la para base64 ou usar uma rota de stream
      // Vamos enviar apenas os nomes por enquanto, e faremos uma rota para o conteúdo
      return {
        name: file,
        size: stats.size,
        path: `/api/triage/image?file=${encodeURIComponent(file)}`
      };
    });

    return NextResponse.json({ files: fileDetails });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao listar arquivos pendentes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { originalName, type, date, value } = await req.json();

    // Validar formato da data (recebe DD/MM/AAAA, extrai DDMM)
    const parts = date.split('/');
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const formattedDate = `${day}${month}`;

    // Validar valor (remover vírgula e garantir 5 caracteres)
    const numericValue = value.replace(',', '').replace('.', '').padStart(5, '0');

    // Montar novo nome: [TIPO][DDMM][VALOR][ORIGINAL]
    const extension = path.extname(originalName);
    const newName = `${type}${formattedDate}${numericValue}${originalName.replace(extension, '')}${extension}`;

    const oldPath = path.join(PENDING_DIR, originalName);
    const newPath = path.join(UPLOADS_DIR, newName);

    fs.renameSync(oldPath, newPath);

    return NextResponse.json({ success: true, newName });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao processar arquivo' }, { status: 500 });
  }
}
