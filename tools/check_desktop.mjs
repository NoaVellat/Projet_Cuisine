import puppeteer from 'puppeteer-core';
const OUT = new URL('./shots/', import.meta.url).pathname;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas');
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => window.__sceneStore.getState().enter());
await new Promise((r) => setTimeout(r, 3500));
await page.evaluate(() => document.querySelector('.welcome-card button')?.click());
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => window.__sceneStore.getState().setQuality('high'));
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}check-desktop-overview.png` });
await page.evaluate(() => window.__sceneStore.getState().goFocus('board'));
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: `${OUT}check-desktop-board.png` });
await page.evaluate(() => window.__sceneStore.getState().goFocus('skills'));
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: `${OUT}check-desktop-skills.png` });
await browser.close();
console.log('OK desktop check');
