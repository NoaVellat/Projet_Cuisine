// Capture rapide des sections du mode classique (défilement).
import puppeteer from 'puppeteer-core';
const OUT = new URL('./shots/', import.meta.url).pathname;
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas');
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => window.__sceneStore.getState().setClassic(true));
await new Promise((r) => setTimeout(r, 400));
for (const [name, sel] of [['carte', '#carte'], ['ingredients', '#ingredients'], ['chef', '#chef'], ['reservations', '#reservations']]) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel);
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}4-classic-${name}.png` });
}
await browser.close();
console.log('OK classic');
