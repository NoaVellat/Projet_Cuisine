// Génère des pochettes d'aperçu « maison » (HTML → webp) pour les projets
// dont la capture live n'est pas parlante : Core_Lab (recréation du hero) et
// My Video Club (pochette cinéma). Sortie : public/previews/<id>.webp
// Lancer : node tools/make_covers.mjs
import puppeteer from 'puppeteer-core';

const OUT = new URL('../public/previews/', import.meta.url).pathname;

const corelab = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;height:100%}
  .wrap{height:100vh;display:grid;place-items:center;position:relative;overflow:hidden;
    background:
      radial-gradient(130% 130% at 12% -5%, #2c31a0 0%, transparent 42%),
      radial-gradient(130% 130% at 105% 108%, #9a2f43 0%, transparent 52%),
      linear-gradient(135deg,#12122e 0%,#241a3c 52%,#160f1e 100%);
    font-family:'Poppins','Segoe UI',system-ui,sans-serif}
  .num{position:absolute;top:30px;left:30px;background:#0c0c16;color:#54e07a;
    font-family:ui-monospace,monospace;font-size:26px;padding:8px 18px;border-radius:7px;letter-spacing:6px}
  .c{text-align:center;padding:0 40px}
  h1{margin:0;font-size:150px;font-weight:800;letter-spacing:-3px;line-height:1;
    background:linear-gradient(90deg,#e2564f 0%,#c0508f 55%,#7b5cf0 100%);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  p{margin:18px 0 0;color:#cbc8db;font-size:27px;font-weight:300}
</style></head><body><div class="wrap">
  <div class="num">06</div>
  <div class="c"><h1>Core_Lab</h1><p>Pour des formations passionnantes, rapides et ludiques.</p></div>
</div></body></html>`;

const videoclub = `<!doctype html><html><head><meta charset="utf8"><style>
  html,body{margin:0;height:100%}
  .wrap{height:100vh;display:flex;flex-direction:column;position:relative;overflow:hidden;
    background:radial-gradient(120% 90% at 50% 0%, #3a1220 0%, #140a0e 70%);
    font-family:'Poppins','Segoe UI',system-ui,sans-serif;color:#f4ece0}
  /* bandes de pellicule haut & bas */
  .strip{height:52px;flex:0 0 auto;background:#0b0b0d;
    background-image:repeating-linear-gradient(90deg,#0b0b0d 0 26px,transparent 26px 44px),
      repeating-linear-gradient(90deg,#f2c85a 30px 48px,transparent 48px 70px);
    background-size:auto,70px 100%;background-position:0 0, 0 0;
    box-shadow:inset 0 0 0 8px #0b0b0d}
  .strip.b{align-self:flex-end}
  .mid{flex:1;display:grid;place-items:center;text-align:center;position:relative}
  .reel{font-size:70px;margin-bottom:6px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
  h1{margin:0;font-size:96px;font-weight:800;letter-spacing:1px;line-height:.95;
    text-shadow:0 0 26px rgba(226,86,79,.55)}
  .sub{margin:16px 0 0;font-family:ui-monospace,monospace;letter-spacing:8px;
    font-size:20px;color:#e08b6a;text-transform:uppercase}
  .glow{position:absolute;inset:0;background:radial-gradient(closest-side,rgba(226,120,86,.25),transparent 70%)}
</style></head><body><div class="wrap">
  <div class="strip"></div>
  <div class="mid"><div class="glow"></div>
    <div><div class="reel">&#127909;</div><h1>My Video<br>Club</h1>
    <p class="sub">Séances &middot; Réservations &middot; Catalogue</p></div>
  </div>
  <div class="strip b"></div>
</div></body></html>`;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 750 });

for (const [id, html] of [['core-lab', corelab], ['my-video-club', videoclub]]) {
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: `${OUT}${id}.webp`, type: 'webp', quality: 88 });
  console.log('OK  ', id);
}
await browser.close();
console.log('Terminé — pochettes dans', OUT);
