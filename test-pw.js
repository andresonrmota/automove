const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

async function run() {
  console.log('Launching...');
  const tempProfilePath = path.join(os.tmpdir(), `automove-pw-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`);
  const context = await chromium.launchPersistentContext(tempProfilePath, {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false,
    viewport: { width: 1280, height: 720 },
  });
  console.log('Context created. Getting page...');
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  console.log('Navigating to MV...');
  try {
    await page.goto('https://move.mv.com.br/', { timeout: 10000 });
    console.log('Navigation successful!');
  } catch (e) {
    console.error('Navigation failed:', e);
  }
  await context.close();
}
run();
