function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramNotification(report: any, projectName?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const enabled = process.env.TELEGRAM_ENABLED === 'true';

  if (!enabled) {
    throw new Error('As notificações do Telegram estão desativadas nas configurações.');
  }
  if (!token || !chatId) {
    throw new Error('Token ou Chat ID do Telegram ausentes.');
  }

  const projectInfo = projectName ? `[${projectName}]\n` : '';
  const header = `🤖 <b>AutoMove: Processamento Concluído!</b>\n${escapeHtml(projectInfo)}\n<b>Resumo:</b>\nTotal processado: ${report.count} arquivo(s)\nTotal valor: R$ ${escapeHtml(String(report.total))}\n\n<b>Lançamentos:</b>\n`;

  let list = '';
  for (const item of report.items) {
    const statusIcon = item.status === 'success' ? '✅' : '❌';
    const errorMsg = item.status === 'error' ? ` (${escapeHtml(item.message || 'Erro ao lançar')})` : '';
    list += `${statusIcon} [${escapeHtml(item.type || 'Desconhecido')}] ${escapeHtml(item.date || '-')} - R$ ${escapeHtml(item.value || '0,00')}${errorMsg}\n`;
  }

  const message = header + list;

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Falha HTTP ${response.status}: ${errorText}`);
    }
  } catch (error) {
    throw error;
  }
}
