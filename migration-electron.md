# Migração para Electron Desktop

## Goal
Transformar o AutoMove em um aplicativo desktop nativo Windows com Next.js (estático) no Frontend e IPC (Inter-Process Communication) no Electron Main Process para gerenciar o Playwright e o File System.

## Tasks
- [x] **Task 1: Instalar dependências necessárias** → Instalar `electron`, `electron-builder` (dev), `concurrently`, `wait-on`, e `electron-serve` se necessário.
- [x] **Task 2: Criar arquivo de configuração do Electron** → Criar `electron/main.js` e `electron/preload.js` estruturando o ciclo de vida da janela e a ponte IPC.
- [x] **Task 3: Configurar o Next.js para Exportação Estática** → Alterar `next.config.ts` para usar `output: 'export'` e desabilitar otimização de imagens incompatível.
- [x] **Task 4: Implementar Handlers IPC no Main Process** → Migrar a lógica de todas as API routes (`settings`, `open-folder`, `browse`, `validate-access`, `triage`, `automation`) para funções no `main.js` escutando eventos de IPC.
- [x] **Task 5: Adaptar Chamadas no Frontend (Renderer)** → Criar um utilitário ou atualizar os hooks/componentes do frontend para chamar `window.electronAPI.xxx` em vez de `fetch('/api/xxx')`.
- [x] **Task 6: Configurar scripts no package.json** → Adicionar scripts para desenvolvimento integrado (`npm run dev:electron`) e empacotamento (`npm run dist`).
- [x] **Task 7: Testar Automação e IPC** → Rodar o app localmente com Electron e verificar se a triagem e o robô (Playwright) rodam perfeitamente usando o Main Process.
- [x] **Task 8: Configurar Build para Windows** → Adicionar seção `"build"` no `package.json` para o `electron-builder` gerar o `.exe`.

## Done When
- [x] O app abre em uma janela nativa do Electron.
- [x] O usuário consegue selecionar pastas usando a caixa de diálogo nativa do Windows.
- [x] A triagem de arquivos (leitura e renomeação local) funciona via IPC.
- [x] O robô Playwright inicia, roda em background e reporta logs em tempo real para a interface React via IPC.
- [x] O executável `.exe` é gerado com sucesso na pasta `dist/`.
