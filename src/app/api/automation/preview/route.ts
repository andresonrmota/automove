import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getFolderConfig } from '@/lib/config';

const TYPE_MAP: Record<string, string> = {
  A: 'Alimentação',
  S: 'Alimentação',
  T: 'Transporte Urbano',
  H: 'Hospedagem',
  E: 'Estacionamento',
  L: 'Lavanderia',
};

export async function GET() {
  try {
    const { triados } = getFolderConfig();

    if (!triados || !fs.existsSync(triados)) {
      return NextResponse.json({ items: [] });
    }

    const files = fs.readdirSync(triados).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.pdf', '.heic', '.webp'].includes(ext);
    });

    const currentYear = new Date().getFullYear();

    const items = files.map(fileName => {
      try {
        const typeChar = fileName[0].toUpperCase();
        const dayStr = fileName.substring(1, 3);
        const monthStr = fileName.substring(3, 5);
        const rawValue = fileName.substring(5, 10);

        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const valueInteger = parseInt(rawValue.substring(0, 3), 10);
        const valueCents = rawValue.substring(3, 5);
        const valueNumeric = parseFloat(`${valueInteger}.${valueCents}`);

        const type = TYPE_MAP[typeChar] ?? 'Outro';
        const date = `${dayStr}/${monthStr}/${currentYear}`;
        const value = valueNumeric.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (isNaN(day) || isNaN(month) || isNaN(valueNumeric)) {
          return { fileName, error: true };
        }

        return { fileName, type, date, value };
      } catch {
        return { fileName, error: true };
      }
    });

    // Sort by date (DD/MM)
    items.sort((a, b) => {
      if (a.error || b.error) return 0;
      const dayA = parseInt(a.date!.substring(0, 2));
      const monthA = parseInt(a.date!.substring(3, 5));
      const dayB = parseInt(b.date!.substring(0, 2));
      const monthB = parseInt(b.date!.substring(3, 5));
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao ler pasta Triados.' }, { status: 500 });
  }
}
