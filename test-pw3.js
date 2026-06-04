const { chromium } = require('playwright');
async function run() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log('Navigating with domcontentloaded...');
  try {
    await page.goto('https://move.mv.com.br/', { timeout: 10000, waitUntil: 'domcontentloaded' });
    console.log('Navigation successful!');
  } catch (e) {
    console.error('Navigation failed:', e);
  }
  await browser.close();
}
run();
