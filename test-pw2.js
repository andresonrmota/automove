const { chromium } = require('playwright');
async function run() {
  console.log('Launching playwright chromium...');
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  console.log('Navigating...');
  try {
    await page.goto('https://move.mv.com.br/', { timeout: 10000 });
    console.log('Navigation successful!');
  } catch (e) {
    console.error('Navigation failed:', e);
  }
  await browser.close();
}
run();
