const { chromium } = require('playwright');

async function run() {
  console.log('Iniciando teste com o Chromium interno do Playwright...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  console.log('Acessando https://www.uol.com.br/ ...');
  try {
    await page.goto('https://www.uol.com.br/', { timeout: 15000, waitUntil: 'domcontentloaded' });
    console.log('UOL carregado com sucesso!');
  } catch (e) {
    console.error('Falha ao carregar UOL:', e);
  }
  
  await browser.close();
  console.log('Teste finalizado.');
}
run();
