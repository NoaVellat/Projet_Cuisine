import puppeteer from 'puppeteer-core';
const OUT = new URL('./shots/mobile/', import.meta.url).pathname;
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
await page.screenshot({ path: `${OUT}0-entry.png` });

await page.evaluate(() => window.__sceneStore.getState().enter());
await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: `${OUT}1-overview-welcome.png` });
await page.evaluate(() => document.querySelector('.welcome-card button')?.click());
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => window.__sceneStore.getState().setQuality('high'));
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: `${OUT}2-overview.png` });

for (const zone of ['drawers', 'skills', 'pass', 'board', 'shelf', 'salle']) {
  await page.evaluate((z) => window.__sceneStore.getState().goFocus(z), zone);
  await new Promise((r) => setTimeout(r, 2200));
  await page.screenshot({ path: `${OUT}3-focus-${zone}.png` });
}

await page.evaluate(() => { const s=window.__sceneStore.getState(); s.goFocus('drawers'); s.goDetail('jeux-videops'); });
await new Promise((r) => setTimeout(r, 2200));
await page.screenshot({ path: `${OUT}4-detail.png` });

await page.evaluate(() => window.__sceneStore.getState().setClassic(true));
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${OUT}5-classic-hero.png` });
for (const sel of ['#carte', '#ingredients', '#chef', '#reservations']) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel);
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${OUT}5-classic-${sel.slice(1)}.png` });
}

await browser.close();
console.log('OK mobile probe');
