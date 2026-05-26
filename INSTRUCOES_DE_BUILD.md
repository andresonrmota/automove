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

---

## 4. Atualização e Distribuição de Novas Versões

Quando você for lançar uma nova versão da aplicação (por exemplo, atualizando para `1.4.0`), o padrão da indústria e do GitHub é **manter o histórico**. Siga este fluxo:

1. **Atualize a versão no código:**
   - No `package.json`, altere o `"version": "1.3.0"` para a nova versão.
   - Em `src/lib/version.ts`, atualize a constante `APP_VERSION`.
2. **Gere os instaladores:**
   - Rode `npm run dist` para gerar os arquivos atualizados (e `npm run dist:mac` caso esteja num ambiente macOS).
3. **Distribuição via GitHub Releases:**
   - **Nunca exclua as versões anteriores.** O GitHub serve justamente como um acervo histórico do seu projeto.
   - Acesse o repositório no GitHub, vá na barra lateral em **"Releases"** e clique em **"Draft a new release"**.
   - Digite o nome da nova tag (ex: `v1.4.0`).
   - Adicione o título, escreva as notas da atualização (o que mudou nesta versão) e arraste os novos instaladores (`.exe` e `.dmg`) gerados na pasta `/dist` para a caixa de upload.
   - Clique em **"Publish release"**.
4. **Atualize o Site de Downloads:**
   - Abra o código do seu projeto Vercel (`developer-dashboard`).
   - Edite o arquivo `src/components/DownloadsPage.tsx` e troque a versão (ex: `v1.3.0` para `v1.4.0`) diretamente nas URLs dos botões de download.
   - Faça o commit e o Push desse repositório. O Vercel atualizará sua página de downloads automaticamente, que passará a baixar os arquivos da nova Release do GitHub!
