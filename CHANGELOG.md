# Histórico de versões do AutoMove

## 1.8.1 — 2026-11-11

- **Telegram sem Bot Token na tela.** O token do bot `@AutoMoveAndreson_bot` passa a ser fixo no aplicativo (`src/lib/telegram-bot.ts`). A tela Configurações → Telegram pede apenas o **Chat ID** do usuário.
- **Guia do Chat ID.** O botão ℹ️ da tela explica como obter o Chat ID pelo `@userinfobot` e lembra de iniciar a conversa com o bot antes de testar.
- O arquivo `~/.automove/.env` deixa de guardar `TELEGRAM_BOT_TOKEN`; uma linha antiga é removida ao salvar. Backups anteriores continuam sendo importados normalmente.
- Teste de integração, resumo, prints de confirmação e log de falha usam o token fixo.

## 1.8.0

- Correção na seleção do item de despesa e logs de execução.

## 1.6.0

- Melhorias no lançamento de prestações complementares e aspectos de segurança.

## 1.5.0

- Melhorias de usabilidade.
