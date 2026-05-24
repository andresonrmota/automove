import { NextResponse } from 'next/server';
import { getTelegramConfig } from '@/lib/env-config';

export async function POST(req: Request) {
  try {
    const { botToken, chatId } = await req.json();
    const config = getTelegramConfig();
    const finalToken = botToken || config.botToken;
    const finalChatId = chatId || config.chatId;

    if (!finalToken || !finalChatId) {
      return NextResponse.json({ error: 'Token ou Chat ID não informados.' }, { status: 400 });
    }

    const message = `🤖 *AutoMove Teste*\n\nSua integração com o Telegram está funcionando perfeitamente! ✅`;
    const url = `https://api.telegram.org/bot${finalToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: finalChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: `Erro do Telegram: ${errorText}` }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Falha ao tentar conectar ao Telegram.' }, { status: 500 });
  }
}
