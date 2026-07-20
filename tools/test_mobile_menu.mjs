import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas');
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => window.__sceneStore.getState().enter());
await new Promise((r) => setTimeout(r, 3500));
await page.evaluate(() => document.querySelector('.welcome-card button')?.click());
await new Promise((r) => setTimeout(r, 400));

// Tap sur la puce "Compétences" du menu mobile
const chips = await page.$$('.mobile-zone-chip');
const labels = await Promise.all(chips.map((c) => c.evaluate((el) => el.textContent)));
console.log('chips found:', labels);
const idx = labels.indexOf('Compétences');
await chips[idx].tap();
await new Promise((r) => setTimeout(r, 1500));
const state = await page.evaluate(() => {
  const s = window.__sceneStore.getState();
  return { view: s.view, zoneId: s.zoneId };
});
console.log('after tap:', JSON.stringify(state));
await browser.close();
