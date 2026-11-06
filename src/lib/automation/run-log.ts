import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Page } from 'playwright';

export const LOGS_DIR = path.join(os.homedir(), '.automove', 'logs');
const MAX_LOG_FILES = 30;
// Só estas rotas têm URL e corpo gravados: login e demais chamadas nunca entram no log.
const LOGGED_API = /\/api\/int\/v1\/(project_accountabilities|project_expense_items)/;

export type RunLog = { file: string; write: (msg: string) => void };

function pruneOldLogs() {
  const logs = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log')).sort();
  for (const old of logs.slice(0, Math.max(0, logs.length - MAX_LOG_FILES))) {
    fs.rmSync(path.join(LOGS_DIR, old), { force: true });
  }
}

/** Abre um arquivo de log por execução. Falha ao gravar nunca interrompe a automação. */
export function createRunLog(): RunLog {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
  const file = path.join(LOGS_DIR, `automove_${stamp}.log`);
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    pruneOldLogs();
  } catch (err) {
    console.error('[AutoMove] Não foi possível preparar a pasta de logs:', err);
  }
  return {
    file,
    write: (msg: string) => {
      try {
        fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
      } catch (err) {
        console.error('[AutoMove] Não foi possível gravar o log:', err);
      }
    },
  };
}

/** Registra erros da página e as chamadas do portal ligadas ao lançamento. */
export function attachPageDiagnostics(page: Page, write: (msg: string) => void) {
  page.on('pageerror', err => write(`[página] erro: ${err.message}`));
  page.on('console', m => {
    if (m.type() === 'error') write(`[página] console: ${m.text().slice(0, 300)}`);
  });
  page.on('response', async response => {
    const url = response.url();
    if (!LOGGED_API.test(url)) return;
    const method = response.request().method();
    const line = `[api] ${method} ${url.replace(/^https?:\/\/[^/]+/, '')} -> ${response.status()}`;
    try {
      if (response.status() >= 400) {
        write(`${line} ${(await response.text()).slice(0, 500)}`);
      } else if (url.includes('project_expense_items')) {
        const items: { title?: string; name?: string }[] = await response.json();
        write(`${line} itens=${JSON.stringify(items.map(i => i?.title || i?.name))}`);
      } else {
        write(line);
      }
    } catch {
      write(line);
    }
  });
}

/** Fotografa em texto o estado do formulário, sem tocar em foco nem em valores. */
export async function logFormState(page: Page, write: (msg: string) => void, step: string) {
  try {
    const state = await page.evaluate(() => {
      const itemLabel = document.getElementById('select-projectExpenseItemId');
      const submit = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Incluir despesa'));
      const active = document.activeElement;
      return {
        rota: location.pathname,
        foco: active ? `${active.tagName}#${active.id}` : null,
        itemTexto: (itemLabel?.parentElement as HTMLElement | null)?.innerText ?? null,
        opcoes: Array.from(document.querySelectorAll('[class*="-option"]')).map(o => o.textContent).slice(0, 15),
        menu: (document.querySelector('[class*="-menu"]') as HTMLElement | null)?.innerText?.slice(0, 200) ?? null,
        data: (document.querySelector('input[name="expenseDate"]') as HTMLInputElement | null)?.value ?? null,
        botaoIncluirDesabilitado: submit?.disabled ?? null,
      };
    });
    write(`[form:${step}] ${JSON.stringify(state)}`);
  } catch (err) {
    write(`[form:${step}] indisponível: ${err instanceof Error ? err.message : String(err)}`);
  }
}
