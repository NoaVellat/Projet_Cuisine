// Bruitages de cuisine synthétisés en WebAudio — zéro asset à télécharger.
// L'AudioContext ne peut naître que dans un geste utilisateur (autoplay policy) :
// initAudio() est appelé au premier clic (« Pousser les portes »).
let ctx = null;
let master = null;

export function initAudio(muted = false) {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  // On respecte l'état muet dès la création : si l'utilisateur a coupé le son
  // sur l'écran d'entrée (avant que le contexte n'existe), on démarre à 0.
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
  startAmbience();
}

export function setAudioMuted(muted) {
  if (!ctx) return;
  master.gain.setTargetAtTime(muted ? 0 : 0.6, ctx.currentTime, 0.08);
}

function noiseBuffer(seconds, brown = false) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    // bruit brun : blanc intégré → grave et doux (souffle de hotte)
    data[i] = brown ? (last = (last + 0.02 * white) / 1.02) * 3.5 : white;
  }
  return buf;
}

// Bruit filtré avec enveloppe et balayage de fréquence — la brique de base
function playNoise({ dur, type = 'lowpass', f0, f1, q = 1, gain }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start();
}

// Corps résonnant frappé : une somme de partiels qui s'éteignent chacun à son
// rythme. C'est le RAPPORT entre ces partiels qui fait entendre la matière —
// entiers = note franche, irrationnels = métal ; et plus un partiel est haut,
// plus il doit mourir vite, sinon le son sonne « cloche de synthé ».
function struck(f, partials, type = 'sine') {
  const t = ctx.currentTime;
  for (const [mult, g0, dur] of partials) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

function playTone(freq, dur, gain, detune = 0) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  osc.detune.value = detune;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g).connect(master);
  osc.start();
  osc.stop(t + dur);
}

export const sfx = {
  // Battement des portes : souffle grave qui s'ouvre puis retombe
  whoosh() {
    if (!ctx) return;
    playNoise({ dur: 0.9, f0: 220, f1: 1200, gain: 0.5 });
    playNoise({ dur: 1.1, f0: 900, f1: 180, gain: 0.3 });
  },
  // Cloche du passe — l'arrivée en cuisine
  bell() {
    if (!ctx) return;
    playTone(1046, 1.6, 0.12);
    playTone(1568, 1.2, 0.06, 8);
    playTone(2093, 0.5, 0.03);
  },
  // Coulissement de tiroir sur ses rails
  slide() {
    if (!ctx) return;
    playNoise({ dur: 0.3, type: 'bandpass', f0: 380, f1: 620, q: 2.5, gain: 0.3 });
    setTimeout(() => ctx && playTone(140, 0.08, 0.1), 220); // butée
  },
  // Petit tick de navigation
  tick() {
    if (!ctx) return;
    playNoise({ dur: 0.06, type: 'highpass', f0: 2400, f1: 3200, gain: 0.14 });
  },
  // Xylophone de casseroles : partiels inharmoniques = son métallique
  potNote(i) {
    if (!ctx) return;
    const freqs = [392, 466.16, 523.25, 622.25]; // sol · la♯ · do · ré♯
    struck(freqs[i] ?? 440, [[1, 0.2, 1.1], [2.76, 0.07, 0.4], [5.4, 0.025, 0.15]]);
    playNoise({ dur: 0.03, type: 'highpass', f0: 3200, f1: 2200, gain: 0.1 });
  },
  // Bocaux = timbre « verre » : sinus purs plus aigus, longue traîne cristalline
  glassNote(i) {
    if (!ctx) return;
    const freqs = [880, 1174.66]; // la5 · ré6
    struck(freqs[i] ?? 988, [[1, 0.14, 1.8], [3.01, 0.04, 0.9], [6.1, 0.02, 0.5]]);
  },
  // Les manettes du piano de cuisson… jouent du piano. Corde frappée : les
  // partiels d'une corde raide ne sont pas des multiples exacts, ils montent
  // (inharmonicité B) — c'est ce petit décalage qui distingue une corde d'un
  // orgue. Gamme pentatonique de do sur 7 manettes (do ré mi sol la do ré) :
  // n'importe quel ordre, n'importe quel accord reste juste.
  pianoKey(i) {
    if (!ctx) return;
    const f0 = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33][i] ?? 329.63;
    const B = 0.0006;
    const t = ctx.currentTime;
    for (let n = 1; n <= 6; n++) {
      const osc = ctx.createOscillator();
      osc.type = n === 1 ? 'triangle' : 'sine';
      osc.frequency.value = f0 * n * Math.sqrt(1 + B * n * n);
      osc.detune.value = n % 2 ? 1.5 : -1.5; // deux cordes par touche, jamais pile d'accord
      const g = ctx.createGain();
      const g0 = 0.16 / (n * n * 0.55 + 1);
      const dur = 2.4 / (1 + n * 0.75);
      // Attaque en 4 ms : c'est le marteau, pas une nappe
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(g0, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    playNoise({ dur: 0.05, type: 'lowpass', f0: 2600, f1: 400, gain: 0.09 }); // le feutre
  },
  // La barre d'ustensiles = la percussion du poste. Quatre matières, quatre
  // synthèses différentes — pas la même note transposée quatre fois.
  utensilHit(i) {
    if (!ctx) return;
    if (i === 0) {
      // Louche : la demi-sphère d'inox est un petit gong grave et court
      struck(196, [[1, 0.17, 1.4], [2.4, 0.06, 0.6], [3.9, 0.03, 0.35], [7.2, 0.012, 0.2]]);
      playNoise({ dur: 0.05, type: 'bandpass', f0: 900, f1: 400, q: 2, gain: 0.08 });
    } else if (i === 1) {
      // Écumoire : le disque percé, c'est la cymbale — partiels très
      // irrationnels noyés dans un souffle aigu qui traîne bien après.
      struck(523, [[1, 0.045, 1.6], [1.41, 0.04, 1.4], [2.13, 0.03, 1.1], [3.37, 0.022, 0.9], [4.71, 0.015, 0.7]]);
      playNoise({ dur: 1.2, type: 'highpass', f0: 5200, f1: 2600, gain: 0.08 });
    } else if (i === 2) {
      // Spatule bois : un bloc de bois, tout se joue dans les 60 premières ms
      struck(740, [[1, 0.13, 0.09], [2.9, 0.05, 0.05]], 'triangle');
      playNoise({ dur: 0.035, type: 'bandpass', f0: 1800, f1: 900, q: 6, gain: 0.16 });
    } else {
      // Fouet : des fils d'inox qui s'entrechoquent — un shaker. Deux bouffées
      // de grésil décalées et un rien de métal : surtout PAS une note.
      playNoise({ dur: 0.09, type: 'highpass', f0: 6400, f1: 3400, gain: 0.14 });
      setTimeout(() => ctx && playNoise({ dur: 0.13, type: 'highpass', f0: 5200, f1: 2800, gain: 0.09 }), 70);
      struck(1660, [[1, 0.02, 0.35], [1.63, 0.015, 0.25]]);
    }
  },
  // La marmite : gros bouillon
  blup() {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const g = ctx.createGain();
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.22);
    playNoise({ dur: 0.12, f0: 600, f1: 200, gain: 0.1 });
  },
  // Le canard de debug
  quack() {
    if (!ctx) return;
    const coin = (delay) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const g = ctx.createGain();
      const t = ctx.currentTime + delay;
      osc.frequency.setValueAtTime(360, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.11);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.15);
    };
    coin(0);
    coin(0.16);
  },
  // Mini-jeu du steak — on retourne : petit « flac » mat (la viande retombe
  // dans la fonte) + une bouffée de grésil qui reprend de plus belle.
  flipSteak() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.12);
    playNoise({ dur: 0.14, type: 'highpass', f0: 4200, f1: 2600, gain: 0.12 });
  },
  // Envoi réussi : petit carillon ascendant (2 étoiles = 2 notes, 3 = 3), clair
  steakWin(stars = 3) {
    if (!ctx) return;
    const notes = [659.25, 783.99, 1046.5]; // mi · sol · do — triade joyeuse
    for (let i = 0; i < Math.max(2, stars); i++) {
      setTimeout(() => ctx && (playTone(notes[i], 0.5, 0.1, 4), playTone(notes[i] * 2, 0.25, 0.025)), 110 * i);
    }
  },
  // Envoi raté : buzzer grave à deux temps (« non, chef »)
  steakFail() {
    if (!ctx) return;
    const buzz = (delay, f) => {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      osc.connect(lp).connect(g).connect(master);
      osc.start(t);
      osc.stop(t + 0.2);
    };
    buzz(0, 150);
    buzz(0.19, 116);
  },
  // Le tiroir secret du chef : grincement de tiroir + carillon mystérieux
  // ascendant, façon « passage caché découvert »
  secret() {
    if (!ctx) return;
    playNoise({ dur: 0.25, type: 'bandpass', f0: 260, f1: 850, q: 3, gain: 0.16 });
    const notes = [587.33, 698.46, 830.61, 1174.66]; // ré · fa · sol♯ · ré — arpège diminué, un peu louche
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!ctx) return;
        playTone(f, 0.7, 0.08, 5);
        playTone(f * 2, 0.35, 0.02); // petit halo cristallin à l'octave
      }, 90 * i);
    });
  },
};

// Grésil du steak : bruit filtré en boucle, tenu tant que la viande cuit.
// On garde le nœud au niveau module pour pouvoir le couper (sizzleStop) et en
// faire monter l'intensité quand ça approche du cramé (sizzleLevel).
let sizzle = null;

export function sizzleStart() {
  if (!ctx || sizzle) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(2);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1600;
  bp.Q.value = 0.6;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 700;
  const g = ctx.createGain();
  g.gain.value = 0.0001;
  g.gain.setTargetAtTime(0.11, ctx.currentTime, 0.25); // le contact monte vite
  src.connect(bp).connect(hp).connect(g).connect(master);
  src.start();
  sizzle = { src, g };
  // Crépitements aléatoires par-dessus le souffle, tant que ça grésille
  const crackle = () => {
    if (!sizzle) return;
    if (Math.random() < 0.6) {
      playNoise({ dur: 0.03, type: 'bandpass', f0: 1800 + Math.random() * 2200, f1: 900, q: 5, gain: 0.05 });
    }
    setTimeout(crackle, 90 + Math.random() * 220);
  };
  crackle();
}

// 0 = début de cuisson, 1 = au bord du cramé : le grésil devient plus dense
export function sizzleLevel(x) {
  if (!sizzle) return;
  sizzle.g.gain.setTargetAtTime(0.1 + 0.14 * Math.min(1, Math.max(0, x)), ctx.currentTime, 0.2);
}

export function sizzleStop() {
  if (!sizzle) return;
  const { src, g } = sizzle;
  sizzle = null; // coupe la boucle de crépitements
  g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
  setTimeout(() => {
    try {
      src.stop();
    } catch {
      /* déjà arrêté */
    }
  }, 400);
}

// Ambiance : souffle grave continu de hotte + mijotage de la marmite
function startAmbience() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(3, true);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 260;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(filter).connect(g).connect(master);
  src.start();

  // Petites bulles aléatoires, très discrètes — la marmite frémit
  const simmer = () => {
    if (Math.random() < 0.75) {
      playNoise({ dur: 0.07, type: 'bandpass', f0: 300 + Math.random() * 500, f1: 150, q: 4, gain: 0.035 });
    }
    setTimeout(simmer, 250 + Math.random() * 600);
  };
  simmer();
}
