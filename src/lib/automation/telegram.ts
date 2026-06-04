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
  
  // Função auxiliar para converter DD/MM/YYYY em um número YYYYMMDD para ordenação
  const parseDateForSort = (dateStr?: string): number => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.split('/');
    if (parts.length >= 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return parseInt(`${year}${month}${day}`, 10);
    }
    return 0;
  };

  // Ordenar os itens cronologicamente (do mais antigo para o mais recente)
  const sortedItems = [...(report.items || [])].sort((a, b) => {
    return parseDateForSort(a.date) - parseDateForSort(b.date);
  });

  for (const item of sortedItems) {
    const statusIcon = item.status === 'success' ? '✅' : '❌';
    const errorMsg = item.status === 'error' ? ` (${escapeHtml(item.message || 'Erro ao lançar')})` : '';
    list += `${statusIcon} [${escapeHtml(item.type || 'Desconhecido')}] ${escapeHtml(item.date || '-')} - R$ ${escapeHtml(item.value || '0,00')}${errorMsg}\n`;
  }

  const footer = `\n<b>Verifique as informação lançadas no Move, VALIDANDO-AS! Se estiverem ok, basta agora enviar para a aprovação.</b>`;
  const message = header + list + footer;

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
