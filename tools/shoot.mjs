// Capture la scène à chaque POI via le Chrome local, pour valider les cadrages.
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: [
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    // WebGL en headless : autoriser le fallback logiciel (requis depuis Chrome 139)
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
  ],
});
browser.on('disconnected', () => console.error('BROWSER DISCONNECTED'));

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error') console.error('CONSOLE:', m.text());
});

// domcontentloaded : networkidle0 peut ne jamais arriver (websocket HMR de Vite)
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('canvas');
await new Promise((r) => setTimeout(r, 3000)); // chargement + caméra qui se pose

// En headless le rendu logiciel est lent → PerformanceMonitor bascule en 'low'
// (sans ombres ni postprocessing). On force 'high' avant chaque capture pour
// voir le rendu réel d'un GPU normal.
const shot = async (name) => {
  await page.evaluate(() => window.__sceneStore.getState().setQuality('high'));
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: `${OUT}${name}.png` });
};

await shot('0-entry');

// Pousser les portes → traversée vers l'overview
await page.evaluate(() => window.__sceneStore.getState().enter());
await new Promise((r) => setTimeout(r, 450));
await page.screenshot({ path: `${OUT}0-entry-crossing.png` }); // battants en cours d'ouverture
await new Promise((r) => setTimeout(r, 3200));
await shot('1-overview');

for (const zone of ['drawers', 'skills', 'pass', 'board', 'shelf']) {
  await page.evaluate((z) => window.__sceneStore.getState().goFocus(z), zone);
  await new Promise((r) => setTimeout(r, 2200)); // damping ~0.45 → laisser se poser
  await shot(`2-focus-${zone}`);
}

// Vues detail : un tiroir de chaque rangée
for (const id of ['jeux-videops', 'my-notion']) {
  await page.evaluate((pid) => {
    const s = window.__sceneStore.getState();
    s.goFocus('drawers');
    s.goDetail(pid);
  }, id);
  await new Promise((r) => setTimeout(r, 2200));
  await shot(`3-detail-${id}`);
}

await browser.close();
console.log('OK — captures dans', OUT);
