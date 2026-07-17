// Capture une petite image d'aperçu de chaque projet en ligne, pour les
// vignettes des tickets (chambre froide + bon de commande). Sortie : des .webp
// légers dans public/previews/<id>.webp — le front les charge via projectThumb().
// Lancer : node tools/shoot_previews.mjs   (Chrome local requis, accès réseau)
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const OUT = new URL('../public/previews/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// id (= CONTENT.projects[].id) → URL à capturer
const PROJECTS = [
  ['jeux-videops', 'https://noavellat.github.io/Jeux_Videops/'],
  ['klivio', 'https://noavellat.github.io/Klivio/'],
  ['my-video-club', 'https://github.com/NoaVellat'],
  ['generateur-cv', 'https://noavellat.github.io/My_CV_generator/'],
  ['my-notion', 'https://my-notion-pcwl.vercel.app/'],
  ['core-lab', 'https://github.com/NoaVellat/Core_Lab'],
  ['portfolio-terminal', 'https://noa-vellat.netlify.app/'],
];
// NB : core-lab et my-video-club ont des couvertures SUR MESURE (make_covers.mjs)
// — relancer ce script en entier les écraserait.

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--hide-scrollbars', '--force-device-scale-factor=1'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 750 });

for (const [id, url] of PROJECTS) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });
    await new Promise((r) => setTimeout(r, 2500)); // laisser rendre / animer
    await page.screenshot({
      path: `${OUT}${id}.webp`,
      type: 'webp',
      quality: 82,
      clip: { x: 0, y: 0, width: 1200, height: 750 },
    });
    console.log('OK  ', id);
  } catch (e) {
    console.error('FAIL', id, '—', e.message);
  }
}

await browser.close();
console.log('Terminé — vignettes dans', OUT);
