import fs from 'fs';
import path from 'path';
import os from 'os';

const ENV_PATH = path.join(os.homedir(), '.automove', '.env');

export interface TelegramConfig {
  enabled: boolean;
  chatId: string;
}

export function getTelegramConfig(): TelegramConfig {
  let chatId = process.env.TELEGRAM_CHAT_ID || '';
  let enabled = process.env.TELEGRAM_ENABLED === 'true';

  // Read directly from file to ensure we get latest if process.env hasn't refreshed
  if (fs.existsSync(ENV_PATH)) {
    const raw = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = raw.split('\n');
    lines.forEach(line => {
      if (line.startsWith('TELEGRAM_CHAT_ID=')) chatId = line.split('=')[1]?.replace(/"/g, '') || '';
      if (line.startsWith('TELEGRAM_ENABLED=')) enabled = line.split('=')[1]?.trim() === 'true';
    });
  }

  return { enabled, chatId };
}

export function saveTelegramConfig(config: TelegramConfig): void {
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  // TELEGRAM_BOT_TOKEN é descartado: o token agora é fixo no app (telegram-bot.ts)
  const lines = envContent.split('\n').filter(line =>
    !line.startsWith('TELEGRAM_BOT_TOKEN=') &&
    !line.startsWith('TELEGRAM_CHAT_ID=') &&
    !line.startsWith('TELEGRAM_ENABLED=')
  );

  lines.push(`TELEGRAM_ENABLED=${config.enabled}`);
  lines.push(`TELEGRAM_CHAT_ID="${config.chatId}"`);

  const newContent = lines.filter(l => l.trim() !== '').join('\n') + '\n';
  fs.writeFileSync(ENV_PATH, newContent, 'utf-8');

  // Update process.env immediately for current runtime
  process.env.TELEGRAM_ENABLED = String(config.enabled);
  process.env.TELEGRAM_CHAT_ID = config.chatId;
}
