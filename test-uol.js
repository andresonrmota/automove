const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

async function run() {
  console.log('Iniciando teste de navegador para UOL...');
  const tempProfilePath = path.join(os.tmpdir(), `automove-pw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  
  const context = await chromium.launchPersistentContext(tempProfilePath, {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    viewport: { width: 1280, height: 720 },
  });
  
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  console.log('Acessando https://www.uol.com.br/ ...');
  try {
    await page.goto('https://www.uol.com.br/', { timeout: 30000 });
    console.log('UOL carregado com sucesso!');
    console.log('Mantendo a janela aberta por 10 segundos para visualizacao...');
    await page.waitForTimeout(10000);
  } catch (e) {
    console.error('Falha ao carregar UOL:', e);
  }
  
  await context.close();
  console.log('Teste finalizado.');
}
run();
