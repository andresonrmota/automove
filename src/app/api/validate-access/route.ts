import { NextResponse } from 'next/server';
import { chromium } from 'playwright';

interface AccessPayload {
  user: string;
  pass: string;
  client: string;
}

export async function POST(req: Request) {
  try {
    const { user, pass, client } = await req.json() as AccessPayload;

    if (!user || !pass || !client) {
      return NextResponse.json({ success: false, error: 'Preencha todos os campos antes de validar.' }, { status: 400 });
    }

    const browser = await chromium.launch({ headless: true, slowMo: 30 });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    try {
      await page.goto('https://move.mv.com.br/', { waitUntil: 'networkidle', timeout: 20000 });

      const userField = page.locator('input.MuiOutlinedInput-input').nth(0);
      await userField.waitFor({ state: 'visible', timeout: 10000 });
      await userField.fill(user);

      const passField = page.locator('input[type="password"]');
      await passField.fill(pass);

      const companySelect = page.locator('#demo-simple-select-outlined');
      if (await companySelect.isVisible()) {
        await companySelect.click();
        const option = page.locator(`li[role="option"]:has-text("${client}")`);
        await option.waitFor({ state: 'visible', timeout: 5000 });
        await option.click();
      }

      await page.locator('button.MuiButton-contained').click();

      const outcome = await Promise.race([
        page.waitForURL('**/site**', { timeout: 15000 }).then(() => 'success' as const),
        page.waitForSelector('text="Usuário ou senha inválidos"', { timeout: 15000 }).then(() => 'invalid' as const),
      ]).catch(() => 'timeout' as const);

      if (outcome === 'success') {
        return NextResponse.json({ success: true });
      } else if (outcome === 'invalid') {
        return NextResponse.json({ success: false, error: 'Usuário ou senha inválidos no portal MOVE.' });
      } else {
        return NextResponse.json({ success: false, error: 'Portal MOVE não respondeu. Verifique sua conexão.' });
      }
    } finally {
      await browser.close();
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Erro ao tentar conectar ao portal MOVE.' }, { status: 500 });
  }
}
