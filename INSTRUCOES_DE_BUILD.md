# AutoMove - Instruções de Execução e Build

Este documento contém as instruções para emular (rodar) a aplicação no ambiente de desenvolvimento, bem como gerar os arquivos de instalação para Windows (`.exe`) e macOS (`.dmg`).

## 1. Emulando a Aplicação (Ambiente de Desenvolvimento)

Para iniciar a aplicação em modo de desenvolvimento (o que iniciará o servidor do Next.js e abrirá a janela do Electron simultaneamente), execute o seguinte comando na raiz do projeto:

```bash
npm run dev:electron
```

Este comando utiliza o pacote `concurrently` para rodar o Next.js na porta 3000, compilar os arquivos do processo principal (`main.ts` e `preload.js` via `esbuild`) e iniciar a aplicação desktop do Electron.

---

## 2. Gerando o Executável para Windows (.exe)

Para compilar o aplicativo e gerar o instalador para **Windows**, execute:

```bash
npm run dist
```

**O que este comando faz:**
- Primeiramente, faz o build da parte web (Next.js) gerando os arquivos estáticos no diretório `out`.
- Em seguida, compila os arquivos do Electron (processo principal) para o diretório `dist-electron`.
- Por fim, o `electron-builder` é chamado, empacotando tudo num arquivo executável (usando a configuração NSIS definida no `package.json`).

Os arquivos compilados (incluindo o `.exe`) poderão ser encontrados no diretório `dist/`.

---

## 3. Gerando a Imagem para macOS (.dmg)

Para compilar o aplicativo e gerar o instalador para **macOS**, execute:

```bash
npm run dist:mac
```

**Importante:**
- Este comando deve ser executado, preferencialmente, a partir de um sistema macOS para garantir que a assinatura e o empacotamento da aplicação funcionem corretamente.
- A configuração atual no `package.json` possui as arquiteturas configuradas para gerar tanto para processadores Intel (`x64`) quanto para Apple Silicon (`arm64`).

Os arquivos compilados (incluindo o `.dmg`) poderão ser encontrados no diretório `dist/`.

---

## Observações Gerais

- **Pré-requisitos:** Certifique-se de ter executado `npm install` caso seja a primeira vez que você está executando ou fazendo build do projeto, ou após qualquer mudança nas dependências do `package.json`.
- **Arquivos Finais:** Todo o resultado dos comandos de distribuição (`npm run dist` ou `npm run dist:mac`) ficará disponível na pasta `/dist` na raiz do seu projeto.
