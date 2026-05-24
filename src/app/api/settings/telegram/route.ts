import { NextResponse } from 'next/server';
import { getTelegramConfig, saveTelegramConfig } from '@/lib/env-config';

export async function GET() {
  const config = getTelegramConfig();
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body) {
      saveTelegramConfig(body);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Erro ao salvar configurações do Telegram.' }, { status: 500 });
  }
}
