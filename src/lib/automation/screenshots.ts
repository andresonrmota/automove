import type { Page } from 'playwright';

const MAX_FINAL_SCREENSHOTS = 20;

/**
 * Captura prints da tela de lançamentos ao final do processo.
 * Localiza o elemento que rola (o container da tabela ou a própria página),
 * rola de viewport em viewport e tira um print a cada passo, de modo que o
 * conjunto cubra a tela inteira. Nunca lança erro: em caso de falha devolve
 * o que conseguiu capturar (no mínimo tenta um print simples).
 */
export async function captureFinalScreenshots(page: Page, log: (msg: string) => void): Promise<Buffer[]> {
  const screenshots: Buffer[] = [];
  try {
    await page.waitForTimeout(1500);

    // Descobre o container que rola e o marca com um atributo para uso posterior
    const scrollInfo = await page.evaluate(() => {
      const isScrollable = (el: Element) => {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 5;
      };

      let container: Element | null = null;
      const table = document.querySelector('table');
      let current: Element | null = table ? table.parentElement : null;
      while (current && current !== document.body) {
        if (isScrollable(current)) {
          container = current;
          break;
        }
        current = current.parentElement;
      }

      document.querySelectorAll('[data-automove-scroll]').forEach(el => el.removeAttribute('data-automove-scroll'));

      if (container) {
        container.setAttribute('data-automove-scroll', '1');
        return { mode: 'element', scrollHeight: container.scrollHeight, clientHeight: container.clientHeight };
      }

      const root = document.scrollingElement || document.documentElement;
      return { mode: 'page', scrollHeight: root.scrollHeight, clientHeight: window.innerHeight };
    });

    const step = Math.max(scrollInfo.clientHeight, 100);
    const totalSteps = Math.min(
      Math.max(1, Math.ceil(scrollInfo.scrollHeight / step)),
      MAX_FINAL_SCREENSHOTS
    );

    log(`[AutoMove] 📸 Capturando ${totalSteps} print(s) da tela de lançamentos...`);

    for (let i = 0; i < totalSteps; i++) {
      const offset = i * step;
      await page.evaluate(({ mode, offset }) => {
        if (mode === 'element') {
          const el = document.querySelector('[data-automove-scroll]');
          if (el) el.scrollTop = offset;
        } else {
          window.scrollTo(0, offset);
        }
      }, { mode: scrollInfo.mode, offset });
      await page.waitForTimeout(500);
      screenshots.push(await page.screenshot({ type: 'png' }));
    }

    // Volta ao topo para a tela ficar no estado original
    await page.evaluate(({ mode }) => {
      if (mode === 'element') {
        const el = document.querySelector('[data-automove-scroll]');
        if (el) {
          el.scrollTop = 0;
          el.removeAttribute('data-automove-scroll');
        }
      } else {
        window.scrollTo(0, 0);
      }
    }, { mode: scrollInfo.mode });
  } catch (err) {
    console.error('[AutoMove] Erro ao capturar prints finais:', err);
    if (screenshots.length === 0) {
      try {
        screenshots.push(await page.screenshot({ type: 'png' }));
      } catch {
        // sem print possível
      }
    }
  }
  return screenshots;
}
