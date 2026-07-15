// Bruitages de cuisine synthétisés en WebAudio — zéro asset à télécharger.
// L'AudioContext ne peut naître que dans un geste utilisateur (autoplay policy) :
// initAudio() est appelé au premier clic (« Pousser les portes »).
let ctx = null;
let master = null;

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.6;
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
    const f = freqs[i] ?? 440;
    const t = ctx.currentTime;
    for (const [mult, g0, dur] of [[1, 0.2, 1.1], [2.76, 0.07, 0.4], [5.4, 0.025, 0.15]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(g0, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    playNoise({ dur: 0.03, type: 'highpass', f0: 3200, f1: 2200, gain: 0.1 });
  },
  // Bocaux = timbre « verre » : sinus purs plus aigus, longue traîne cristalline
  glassNote(i) {
    if (!ctx) return;
    const freqs = [880, 1174.66]; // la5 · ré6
    const f = freqs[i] ?? 988;
    const t = ctx.currentTime;
    for (const [mult, g0, dur] of [[1, 0.14, 1.8], [3.01, 0.04, 0.9], [6.1, 0.02, 0.5]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(g0, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
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
};

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
