# Histórico de versões do AutoMove

## 1.8.2 — 2026-11-12

- **Pop-up do portal não trava mais o lançamento.** Quando o Move demorava a gravar, o pop-up "Despesa incluída" aparecia atrasado, ficava aberto e bloqueava todas as notas seguintes. O robô agora espera o portal confirmar a gravação e fecha qualquer pop-up que tenha ficado aberto antes de cada nota e depois de cada falha.
- **Erros visíveis ao final.** Com notas não lançadas, a tela mostra um aviso "Concluída com N erro(s)" e uma lista com arquivo, tipo, data, valor e motivo de cada nota, e rola até esse aviso. O resumo passa a mostrar "X de Y lançados".
- **Telegram com as notas que falharam.** A mensagem destaca "Concluído com N ERRO(S)", informa quantas notas foram lançadas e lista cada nota não lançada com o motivo.
- O log da execução registra o motivo real quando a notificação do Telegram não é enviada (por exemplo, notificações desativadas).

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
