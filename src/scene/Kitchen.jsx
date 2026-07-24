import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useCursor, useGLTF } from '@react-three/drei';
import { Object3D, Color } from 'three';
import { easing } from 'maath';
import { useSceneStore } from '../store/useSceneStore';
import { useSteakStore, BURN_TOTAL } from '../game/useSteakStore';
import { sizzleLevel } from '../audio/sfx';
import { CONTENT } from '../content/content';
import { LAYOUT as L } from './layout';
import { makeSubwayTexture, makeFloorTexture, makeTerminal, SUBWAY_PERIOD, FLOOR_PERIOD } from './textures';
import { tiltHandlers } from '../ui/tilt';
import { sfx } from '../audio/sfx';
import { hPlusDistanceFactorRatio } from './hplus';
import { TicketBody, Chips } from '../ui/TicketBits';
import { ContactPanel } from '../ui/ContactPanel';
import { BoardPanel } from '../ui/BoardPanel';
import { ChefPanel } from '../ui/ChefPanel';

// Importé via Vite : le nom de fichier reçoit une empreinte de contenu
// (poste-XXXX.glb), donc chaque nouvelle version casse le cache navigateur.
import MODEL from '../assets/poste.glb?url';
const COPPER = '#b87333';
const NO_RAYCAST = () => null;

// Objets interactifs du GLB (nommés dans tools/build_kitchen.py) → zone du store.
const ZONE_BY_NODE = {
  zone_pass: 'pass',
  zone_board: 'board',
  zone_book: 'shelf',
  door_L: 'entry',
  door_R: 'entry',
  // Machine à bons : le ticket CV s'imprime en un clic
  ticket_machine: 'cv',
  ticket_paper: 'cv',
  // Easter eggs & vie de la cuisine
  zone_laptop: 'laptop',
  zone_duck: 'duck',
  zone_duck2: 'duck', // le canard doré du buffet de la salle
  zone_pot: 'pot',
  zone_salle: 'salle',
  zone_bell: 'bell', // sonnette du pupitre d'accueil
  zone_champ: 'champ', // seau à champagne de la salle
  lamp_shade: 'lamp',
  lamp_bulb: 'lamp',
};
for (let i = 0; i < 8; i++) ZONE_BY_NODE[`zone_drawer_${i}`] = 'drawers';
for (let i = 0; i < 5; i++) ZONE_BY_NODE[`zone_bac_${i}`] = 'skills';
for (let i = 0; i < 4; i++) ZONE_BY_NODE[`zone_note_${i}`] = 'notes';
for (let i = 0; i < 5; i++) ZONE_BY_NODE[`zone_veg_${i}`] = 'veg';
for (let i = 0; i < 2; i++) ZONE_BY_NODE[`zone_glass_${i}`] = 'glass';
// Les deux instruments ajoutés au poste : les manettes du piano de cuisson
// (une touche par manette) et la barre d'ustensiles (la percussion).
for (let i = 0; i < 7; i++) ZONE_BY_NODE[`zone_knob_${i}`] = 'knob';
for (let i = 0; i < 4; i++) ZONE_BY_NODE[`zone_ust_${i}`] = 'ust';
// Mini-jeu : le steak à saisir sur le feu avant-droit du piano.
ZONE_BY_NODE.zone_steak = 'steak';

// Une couleur par famille de stack (mêmes teintes que bacs et légumes)
const BAC_COLORS = ['#c0392b', '#5a8a3c', '#c8a636', '#a89a7c', '#c9762e'];

// Pendule des ustensiles frappés : [amortissement, pulsation, amplitude].
// Chacun a son inertie — la louche tape lourd et lent, le fouet part vite et
// léger — sinon les quatre se balancent comme un seul objet.
const UST_SWING = [[1.5, 8.6, 0.26], [1.7, 9.8, 0.24], [2.1, 11.5, 0.2], [2.6, 13.5, 0.17]];

// Position monde du steak (feu avant-droit du piano) — pour la vapeur du grésil.
const STEAK_POS = [L.piano.x + L.piano.burners[3][0], 1.02, L.piano.z + L.piano.burners[3][1]];

// Couleur de la viande selon la chaleur cumulée de la face visible : cru rouge →
// saisi → bien cuit → carbonisé. Interpolation dans un scratch Color (zéro alloc).
const STEAK_STOPS = [
  [0.0, new Color('#b23a47')], // cru
  [0.5, new Color('#8a4a30')], // saisi
  [0.95, new Color('#4f2f1e')], // bien cuit
  [1.5, new Color('#2a1b12')], // très cuit
  [2.4, new Color('#100c0a')], // carbonisé
];
const _steakCol = new Color();
function steakColor(v) {
  for (let i = 1; i < STEAK_STOPS.length; i++) {
    const [t1, c1] = STEAK_STOPS[i];
    if (v <= t1 || i === STEAK_STOPS.length - 1) {
      const [t0, c0] = STEAK_STOPS[i - 1];
      const f = Math.min(1, Math.max(0, (v - t0) / (t1 - t0)));
      return _steakCol.copy(c0).lerp(c1, f);
    }
  }
  return _steakCol.copy(STEAK_STOPS[0][1]);
}

// Zones qui « respirent » en cuivre en vue d'ensemble : les sections du
// portfolio (les easter eggs, eux, se découvrent au survol).
const GLOW_HINT_ZONES = new Set(['drawers', 'skills', 'board', 'shelf', 'pass', 'cv', 'salle', 'laptop']);

// Pastilles « où cliquer » de la vue d'ensemble : ancrées en 3D, rendues en
// DOM (lisibles et cliquables à coup sûr — retours UX : « on ne sait pas où
// cliquer »). La salle a déjà son repère DOM dédié (room-marker).
const HOTSPOTS = [
  { zone: 'drawers', label: 'Les projets', sub: 'ouvrez les tiroirs', pos: [0, (L.drawers.rows[0] + L.drawers.rows[1]) / 2, L.drawers.z + 0.22] },
  { zone: 'skills', label: 'Compétences', sub: 'la saladette', pos: [L.saladette.x, 1.26, L.saladette.z + 0.2] },
  // Au-dessus du cadre (haut du tableau ≈ board.y+0.39) : ne recouvre plus
  // le titre « LE PARCOURS » ni les post-its comme avant.
  { zone: 'board', label: 'Le parcours', sub: 'le tableau', pos: [L.board.x - 0.28, L.board.y + 0.52, L.board.z + 0.15] },
  { zone: 'shelf', label: 'Le chef', sub: 'son histoire', pos: [L.book.x, L.shelf.y + 0.12, L.shelf.z + 0.15] },
  { zone: 'pass', label: 'Contact', sub: 'le passe', pos: [L.pass.x, L.pass.shelfY + 0.06, L.pass.z + 0.1] },
  // À côté de la machine (pas au-dessus) : hauteur ~ celle du haut de la
  // machine, décalée sur le côté (gauche, à l'écart du laptop) pour la
  // montrer sans la cacher.
  { zone: 'cv', label: 'Mon CV', sub: 'ticket à imprimer', pos: [L.ticket.x - 0.22, 1.05, L.ticket.z], flip: true },
  { zone: 'laptop', label: 'Mode classique', sub: 'le portable', pos: [L.laptop.x, 1.12, L.laptop.z], flip: true },
  // Le mini-jeu, au-dessus de la poêle du piano (à gauche → pastille dépliée
  // vers la droite pour ne pas sortir du cadre).
  { zone: 'steak', label: '🥩 Cuire un steak', sub: 'le coup de feu', pos: [STEAK_POS[0], 1.16, STEAK_POS[2] + 0.05] },
];

function Hotspots() {
  const goFocus = useSceneStore((s) => s.goFocus);
  const setHovered = useSceneStore((s) => s.setHovered);
  const act = (zone) => {
    if (zone === 'cv') {
      window.open(CONTENT.identity.cvUrl, '_blank', 'noopener,noreferrer');
    } else if (zone === 'laptop') {
      sfx.tick();
      useSceneStore.getState().bootClassic();
    } else if (zone === 'steak') {
      // On plonge sur le piano ET on lance la première commande
      goFocus('steak');
      useSteakStore.getState().start();
    } else {
      goFocus(zone);
    }
  };
  return (
    <>
      {HOTSPOTS.map((h) => (
        // zIndexRange bas : les pastilles restent SOUS le panneau de bienvenue
        // (z-index 8) et le HUD
        <Html key={h.zone} position={h.pos} center zIndexRange={[7, 2]}>
          <button
            className={h.flip ? 'hotspot hotspot-flip' : 'hotspot'}
            onClick={() => act(h.zone)}
            onPointerOver={() => setHovered(h.zone)}
            onPointerOut={() => setHovered(null)}
          >
            <span className="hotspot-dot" aria-hidden="true" />
            <span className="hotspot-label">
              {h.label}
              <em>{h.sub}</em>
            </span>
          </button>
        </Html>
      ))}
    </>
  );
}

// Vignette d'aperçu d'un projet : image dans public/previews/<id>.webp.
// Si le fichier manque, l'<img> onError laisse voir le monogramme de secours.
const projectThumb = (id) => `/previews/${id}.webp`;

// Bandeau-vignette du projet, en tête de ticket (aperçu avant la chambre froide)
function ProjectThumb({ project, accent }) {
  return (
    <div className="ticket-thumb" style={{ '--accent': accent }}>
      <img
        src={projectThumb(project.id)}
        alt={`Aperçu — ${project.title}`}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement.classList.add('is-fallback');
        }}
      />
      <span className="ticket-thumb-mono" aria-hidden="true">
        {project.title.slice(0, 2).toUpperCase()}
      </span>
    </div>
  );
}

// Position façade du tiroir i (grille cols × rangées, pilotée par layout.json)
const drawerPos = (i) => ({
  x: L.drawers.cols[i % L.drawers.cols.length],
  y: L.drawers.rows[Math.floor(i / L.drawers.cols.length)],
});

// Un objet Blender multi-matériaux arrive dans three.js comme un Group
// contenant un mesh par matériau : on remonte jusqu'à la racine "zone_*".
function zoneRootOf(object) {
  let o = object;
  while (o && !(o.name in ZONE_BY_NODE)) o = o.parent;
  return o ?? null;
}

// Matériaux dont l'émission fait partie du design : exclus du glow hover.
// La viande et son gras y sont aussi : un steak cru qui rougeoie en cuivre au
// survol serait bizarre, et sa couleur est déjà pilotée par la cuisson.
const NO_GLOW = new Set(['laptop_screen', 'lamp_bulb', 'lamp_shade', 'steak_meat', 'steak_fat']);

// Décor suspendu au mur (batterie de cuivre, ustensiles, bocaux, herbes) :
// on coupe leur projection d'ombre — leur silhouette dure sur le carrelage
// était l'« ombre moche ». Ils sont sur des barres → pas d'ombre de contact utile.
const NO_WALL_SHADOW = /note_|potrail|utrail|zone_ust|louche|ecumoire|spatule|fouet|jar_|zone_glass|herb|piano_pan|piano_saucepan|knifebar|wallknife/;
function castsWallShadow(o) {
  for (let n = o; n; n = n.parent) if (NO_WALL_SHADOW.test(n.name)) return true;
  return false;
}

// Colonne de vapeur : des sphères translucides qui montent, grossissent et
// s'estompent en boucle — zéro asset, ~négligeable au GPU (meshBasicMaterial).
function Steam({ position, count = 6, size = 0.045, height = 0.5, speed = 0.28 }) {
  const group = useRef();
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        off: i / count,
        drift: 0.015 + Math.random() * 0.03,
        phase: Math.random() * Math.PI * 2,
      })),
    [count]
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    group.current.children.forEach((m, i) => {
      const s = seeds[i];
      const p = (t * speed + s.off) % 1; // progression 0 → 1 de la bouffée
      m.position.set(
        Math.sin(t * 1.4 + s.phase) * s.drift * (1 + p * 4),
        p * height,
        Math.cos(t * 1.1 + s.phase) * s.drift * (1 + p * 3)
      );
      m.scale.setScalar(size * (0.5 + p * 1.7));
      m.material.opacity = 0.22 * (p < 0.12 ? p / 0.12 : 1 - (p - 0.12) / 0.88);
    });
  });
  return (
    <group ref={group} position={position}>
      {seeds.map((_, i) => (
        <mesh key={i} raycast={NO_RAYCAST}>
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color="#e3e9ec" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

export function Kitchen() {
  const { scene, nodes } = useGLTF(MODEL);
  const view = useSceneStore((s) => s.view);
  const zoneId = useSceneStore((s) => s.zoneId);
  const projectId = useSceneStore((s) => s.projectId);
  const goFocus = useSceneStore((s) => s.goFocus);
  const goDetail = useSceneStore((s) => s.goDetail);
  const enter = useSceneStore((s) => s.enter);
  const setHovered = useSceneStore((s) => s.setHovered);
  const hovered = useSceneStore((s) => s.hovered);
  const bacIndex = useSceneStore((s) => s.bacIndex);
  const setBac = useSceneStore((s) => s.setBac);
  const rush = useSceneStore((s) => s.rush);
  // Compense la correction Hor+ du FOV (CameraRig) : sans ça, le ticket-3d
  // (Html distanceFactor, dont la taille écran dépend du FOV vertical)
  // rétrécit visiblement sur un écran étroit alors que tout le reste
  // s'agrandit pour compenser le cadrage.
  const { width, height } = useThree((s) => s.size);
  const dfRatio = hPlusDistanceFactorRatio(45, width / height);
  useCursor(!!hovered);
  const hot = useRef(null); // zone actuellement survolée (racine GLB)
  const zoneRoots = useRef([]); // toutes les racines interactives (glow par frame)
  const doorVel = useRef({ L: 0, R: 0 }); // vitesses angulaires des battants
  const spotRef = useRef();
  const stoveLight = useRef();
  const spotTarget = useMemo(() => new Object3D(), []);
  const noteHits = useRef([-99, -99, -99, -99]); // instants de frappe (xylophone)
  const knobHits = useRef([-99, -99, -99, -99, -99, -99, -99]); // quarts de tour des manettes
  const ustHits = useRef([-99, -99, -99, -99]); // instants de frappe (ustensiles)
  const bellAt = useRef(-99); // instant du dernier coup de sonnette
  const clockNow = useRef(0);
  const term = useRef(null); // terminal animé du laptop
  const lastTerm = useRef(0);
  // Mini-jeu du steak : cuisson temps réel (source de vérité), le store n'en
  // reçoit qu'un miroir throttlé pour le HUD. `round` resynchronise à chaque
  // nouvelle commande, `lastFlips` déclenche le saut au retournement.
  const steak = useRef({ a: 0, b: 0, round: -1, lastFlips: 0, flipAt: -99, spin: 0, spinBase: 0, lastPush: 0 });
  const steakPhase = useSteakStore((s) => s.phase); // pour (dé)monter la vapeur du grésil

  // Préparation du GLB, une seule fois : matériaux clonés sur les zones
  // (pour le glow hover sans affecter le décor qui partage le même inox),
  // raycast coupé sur tout le reste.
  useMemo(() => {
    const roots = new Set();
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = !castsWallShadow(o);
      o.receiveShadow = true;
      const root = zoneRootOf(o);
      if (root) roots.add(root);
      if (root) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        for (const m of [].concat(o.material)) {
          if (m.name === 'door_window') {
            // Verre de hublot : reflet d'environnement coupé + quasi transparent,
            // sinon le verre agit en miroir et masque la cuisine derrière.
            m.envMapIntensity = 0;
            m.opacity = 0.07;
            m.roughness = 0.03;
            m.depthWrite = false;
          }
          if (NO_GLOW.has(m.name)) {
            // On garde leur émission (écran du laptop, lampe) + on la mémorise
            m.userData.noGlow = true;
            m.userData.origEmissive = m.emissiveIntensity;
            if (m.name === 'laptop_screen') {
              // Le terminal du chef : texture canvas animée (typing du build)
              term.current = makeTerminal();
              m.map = term.current.texture;
              m.emissiveMap = term.current.texture;
              m.emissive.set('#ffffff');
              m.emissiveIntensity = 0.9;
              m.userData.origEmissive = 0.9;
              m.needsUpdate = true;
            }
          } else {
            m.emissive.set(COPPER);
            m.emissiveIntensity = 0;
          }
        }
      } else {
        o.raycast = NO_RAYCAST;
      }
    });
    zoneRoots.current = [...roots];
  }, [scene]);

  // Carrelage : mur métro + dalles au sol (répétition calée sur les périodes)
  const wallTex = useMemo(() => {
    const t = makeSubwayTexture();
    t.repeat.set(L.wall.w / SUBWAY_PERIOD.w, L.wall.h / SUBWAY_PERIOD.h);
    return t;
  }, []);
  const floorTex = useMemo(() => {
    const t = makeFloorTexture();
    t.repeat.set(L.floor.size / FLOOR_PERIOD, L.floor.size / FLOOR_PERIOD);
    return t;
  }, []);
  const sideTex = useMemo(() => {
    const t = makeSubwayTexture();
    t.repeat.set(5.2 / SUBWAY_PERIOD.w, L.wall.h / SUBWAY_PERIOD.h);
    return t;
  }, []);
  // Mur droit PERCÉ au gabarit du passage vers la salle (z 0,71→1,91, h 2,2) :
  // trois segments carrelés, chacun avec repeat/offset accordés pour que le
  // motif reste continu (u croît vers +z sur un plan tourné de -90°).
  const sideSegsR = useMemo(() => {
    const segs = [
      { z0: -0.55, z1: 0.71, y0: 0, y1: L.wall.h }, // avant l'ouverture
      { z0: 1.91, z1: 4.65, y0: 0, y1: L.wall.h }, // après l'ouverture
      { z0: 0.71, z1: 1.91, y0: 2.2, y1: L.wall.h }, // au-dessus (linteau)
    ];
    return segs.map((sg) => {
      const t = makeSubwayTexture();
      t.repeat.set((sg.z1 - sg.z0) / SUBWAY_PERIOD.w, (sg.y1 - sg.y0) / SUBWAY_PERIOD.h);
      t.offset.set(((sg.z0 + 0.55) / SUBWAY_PERIOD.w) % 1, (sg.y0 / SUBWAY_PERIOD.h) % 1);
      return { ...sg, tex: t };
    });
  }, []);

  const openProject = view === 'detail' ? CONTENT.projects.find((p) => p.id === projectId) : null;
  const openIndex = openProject ? CONTENT.projects.indexOf(openProject) : -1;

  // Coulissement des tiroirs, battement des portes, spot sur le projet ouvert.
  useFrame((_, delta) => {
    // dt borné : évite les sauts d'animation après un onglet en arrière-plan
    const step = Math.min(delta, 0.05);
    const hotName = hot.current?.name;
    const t = _.clock.elapsedTime;
    clockNow.current = t;

    // Glow de survol dérivé de hot.current CHAQUE frame → jamais « bloqué »
    // (auto-réparant : si un pointerout est manqué, l'état se recorrige seul).
    // En vue d'ensemble, les zones principales « respirent » en cuivre pour
    // signaler le cliquable avant même le survol ; idem les portes à l'accueil.
    const breathe = 0.1 + Math.sin(t * 2.2) * 0.05;
    for (const root of zoneRoots.current) {
      const zone = ZONE_BY_NODE[root.name];
      const idle =
        (view === 'overview' && GLOW_HINT_ZONES.has(zone)) ||
        (view === 'entry' && zone === 'entry')
          ? breathe
          : 0;
      const target = root === hot.current ? 0.5 : idle;
      root.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (!m.userData.noGlow) easing.damp(m, 'emissiveIntensity', target, 0.08, step);
        }
      });
    }

    // Tous les tiroirs, y compris le 8e (secret, sans projet) : rush = « coup
    // de feu » (code Konami) → tout s'ouvre ; survol en focus → entrebâillé.
    // z0 = position REELLE « fermé » du nœud GLB, capturée une fois au repos —
    // PAS L.drawers.z : le pack meshopt (quantization) recale le node.position
    // du groupe pour compenser le repère normalisé (même mécanisme que le scale
    // du zone_bell plus bas). Utiliser L.drawers.z directement décalait TOUS
    // les tiroirs de plusieurs cm vers l'avant en permanence (fermés = déjà
    // entrouverts), surtout visible depuis la plongée de la saladette.
    for (let i = 0; i < 8; i++) {
      const node = nodes[`zone_drawer_${i}`];
      if (!node) continue;
      if (node.userData.z0 === undefined) node.userData.z0 = node.position.z;
      const p = CONTENT.projects[i];
      const open = rush || (p && view === 'detail' && projectId === p.id);
      const peek = !open && zoneId === 'drawers' && hotName === `zone_drawer_${i}` ? 0.06 : 0;
      easing.damp(node.position, 'z', node.userData.z0 + (open ? L.drawers.slide : peek), 0.25, step);
    }

    // Battants d'entrée : ressort sous-amorti (dépassent puis se stabilisent),
    // constantes différentes gauche/droite. Snap final = pas d'oscillation infinie.
    const opened = view !== 'entry';
    const swing = (node, key, target, k, c) => {
      if (!node) return;
      const v = doorVel.current;
      v[key] += (k * (target - node.rotation.y) - c * v[key]) * step;
      node.rotation.y += v[key] * step;
      if (Math.abs(target - node.rotation.y) < 0.002 && Math.abs(v[key]) < 0.02) {
        node.rotation.y = target;
        v[key] = 0;
      }
    };
    // Fermées, les portes restent légèrement ENTROUVERTES : par l'interstice
    // central on aperçoit déjà la cuisine (le vrai « voir à travers »).
    swing(nodes.door_L, 'L', opened ? 1.5 : 0.16, 26, 5.5);
    swing(nodes.door_R, 'R', opened ? -1.5 : -0.16, 19, 4.8);

    // (L'accès à la salle est un passage ouvert à portières nouées : rien ne
    // bat ni ne pivote — la caméra glisse simplement à travers l'arche.)

    // Vie de la cuisine : flammes et four qui vacillent, canard qui se
    // dandine, couteau qui hache, casseroles-notes qui se balancent,
    // terminal du laptop qui tape son build.
    // En dev : scène + caméra exposées pour les scripts de validation (tools/)
    if (import.meta.env.DEV) {
      window.__scene = _.scene;
      window.__cam = _.camera;
    }
    // Une manette qu'on vient de tourner pousse SON foyer : montée franche au
    // clic puis retour au ralenti — l'oreille entend la note, l'œil voit d'où
    // elle vient. L'ordre des manettes suit celui du piano (build_kitchen.py) :
    // 0-3 les feux vifs, 4 le coupe-feu, 5 la friteuse, 6 le four.
    const knobSurge = (i) => {
      const dt = t - knobHits.current[i];
      return dt >= 0 && dt < 0.9 ? 1 - dt / 0.9 : 0;
    };
    const glow = (node, base, surge) => {
      if (!node) return;
      node.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) m.emissiveIntensity = base * surge;
      });
    };
    const cooking = useSteakStore.getState().phase === 'cooking';
    for (let i = 0; i < 4; i++) {
      // Le feu avant-droit (3) pousse tant que le steak grésille dessus
      const cook = i === 3 && cooking ? 0.7 : 0;
      glow(
        nodes[`flame_${i}`],
        1.9 + Math.sin(t * 13 + i * 2.4) * 0.5 + Math.sin(t * 31 + i) * 0.3,
        1 + knobSurge(i) * 1.3 + cook
      );
    }
    // Coupe-feu : la fonte garde la chaleur, elle respire plus lentement
    glow(nodes.coupefeu_glow, 1.2 + Math.sin(t * 3.5) * 0.2, 1 + knobSurge(4) * 1.5);
    // Bain de friture : frémissement rapide et serré
    glow(nodes.friteuse_glow, 0.7 + Math.sin(t * 9) * 0.12 + Math.sin(t * 27) * 0.06, 1 + knobSurge(5) * 1.4);
    // Four : la porte-hublot est un panneau opaque sombre, l'émission reste
    // basse (~0.45) pour lire comme une braise derrière la vitre, pas comme un
    // rectangle orange fluo ; elle monte bien quand on pousse la manette du four.
    glow(nodes.oven_glow, 0.42 + Math.sin(t * 5) * 0.06, 1 + knobSurge(6) * 1.6);
    // Quart de tour de la manette : elle part et revient, le repère cuivre
    // rend le geste lisible même de loin.
    for (let i = 0; i < 7; i++) {
      const n = nodes[`zone_knob_${i}`];
      if (!n) continue;
      const dt = t - knobHits.current[i];
      n.rotation.z = dt >= 0 && dt < 0.6 ? -Math.sin((dt / 0.6) * Math.PI) * 1.2 : 0;
    }
    if (stoveLight.current) {
      // Seuls les foyers du dessus (feux + coupe-feu) éclairent la pièce
      const surge = Math.max(knobSurge(0), knobSurge(1), knobSurge(2), knobSurge(3), knobSurge(4));
      stoveLight.current.intensity = (0.6 + Math.sin(t * 15) * 0.12 + Math.sin(t * 37) * 0.07) * (1 + surge * 1.5);
    }
    if (nodes.zone_duck) {
      nodes.zone_duck.rotation.y = Math.sin(t * 1.3) * 0.18;
      nodes.zone_duck.rotation.z = Math.sin(t * 2.2) * 0.05;
    }
    // Le canard doré de la salle se dandine aussi (plus dignement)
    if (nodes.zone_duck2) nodes.zone_duck2.rotation.y = Math.sin(t * 1.1 + 2) * 0.13;
    // Sonnette : squash bref au clic puis retour élastique. ATTENTION : le
    // scale du nœud GLB n'est PAS 1 (la quantization meshopt normalise le
    // mesh et compense dans le scale) → on multiplie l'échelle d'origine.
    if (nodes.zone_bell) {
      const b = nodes.zone_bell;
      if (b.userData.sy0 === undefined) b.userData.sy0 = b.scale.y;
      const dt = t - bellAt.current;
      b.scale.y = b.userData.sy0 * (dt >= 0 && dt < 0.2 ? 0.65 + (dt / 0.2) * 0.35 : 1);
    }
    // Couteau : rafale de hachage puis pause (le chef taille la mise en place)
    if (nodes.knife) {
      if (nodes.knife.userData.y0 === undefined) nodes.knife.userData.y0 = nodes.knife.position.y;
      const c = t % 2.6;
      const chop = c < 0.7 ? Math.abs(Math.sin(c * 12.6)) * 0.045 : 0;
      nodes.knife.position.y = nodes.knife.userData.y0 + chop;
    }
    // Casseroles frappées : pendule amorti autour du crochet
    for (let i = 0; i < 4; i++) {
      const n = nodes[`zone_note_${i}`];
      if (!n) continue;
      const dt = t - noteHits.current[i];
      n.rotation.z = dt < 4 ? Math.exp(-dt * 1.6) * Math.sin(dt * 9.5) * 0.3 : 0;
    }
    // Ustensiles frappés : même pendule, une inertie par ustensile (UST_SWING)
    for (let i = 0; i < 4; i++) {
      const n = nodes[`zone_ust_${i}`];
      if (!n) continue;
      const [damp, w, amp] = UST_SWING[i];
      const dt = t - ustHits.current[i];
      n.rotation.z = dt < 4 ? Math.exp(-dt * damp) * Math.sin(dt * w) * amp : 0;
    }

    // ---- Mini-jeu du steak ----
    // Source de vérité = ce ref ; le store ne reçoit qu'un miroir throttlé pour
    // le HUD. `round`/`flips` du store pilotent resync et saut, sans coupler la
    // logique à l'endroit d'où start()/flip() sont appelés (scène OU bouton HUD).
    const stk = useSteakStore.getState();
    const S = steak.current;
    if (S.round !== stk.round) {
      S.round = stk.round;
      S.a = 0; S.b = 0; S.spinBase = 0; S.spin = 0; S.lastFlips = 0; S.flipAt = -99;
    }
    if (stk.flips !== S.lastFlips) {
      S.lastFlips = stk.flips;
      S.flipAt = t;
      S.spinBase += Math.PI; // demi-tour : la face saisie remonte
    }
    if (stk.phase === 'cooking') {
      const RATE = 0.135; // ~ « à point » en ~8 s de cuisson bien répartie
      if (stk.down === 0) S.a += RATE * step; else S.b += RATE * step;
      const total = S.a + S.b;
      sizzleLevel((total - 0.9) / (BURN_TOTAL - 0.9)); // le grésil s'affole vers le cramé
      if (t - S.lastPush > 0.08) { stk.setCook(S.a, S.b); S.lastPush = t; }
    }
    const steakNode = nodes.zone_steak;
    if (steakNode) {
      // Face visible = celle qui n'est PAS en contact (la saisie faite remonte)
      const visible = stk.down === 0 ? S.b : S.a;
      const col = steakColor(stk.phase === 'idle' ? 0 : visible);
      steakNode.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) if (m.name === 'steak_meat') m.color.copy(col);
      });
      if (steakNode.userData.y0 === undefined) {
        steakNode.userData.y0 = steakNode.position.y;
        steakNode.userData.rx0 = steakNode.rotation.x;
      }
      const dt = t - S.flipAt;
      const hop = dt >= 0 && dt < 0.4 ? Math.sin((dt / 0.4) * Math.PI) * 0.07 : 0;
      steakNode.position.y = steakNode.userData.y0 + hop;
      easing.damp(S, 'spin', S.spinBase, 0.09, step);
      steakNode.rotation.x = steakNode.userData.rx0 + S.spin;
    }
    // Terminal : redessiné ~8 fois/s, inutile de le faire à chaque frame
    if (term.current && t - lastTerm.current > 0.12) {
      lastTerm.current = t;
      term.current.update(t);
    }

    // Spot chaud braqué sur le tiroir ouvert : le projet passe sous la lampe
    if (spotRef.current) {
      easing.damp(spotRef.current, 'intensity', openProject ? 4 : 0, 0.3, delta);
      if (openIndex >= 0) {
        const { x, y } = drawerPos(openIndex);
        spotRef.current.position.set(x, y + 1.15, 0.85);
        spotTarget.position.set(x, y, L.drawers.z + 0.25);
      }
    }
  });

  const onClick = (e) => {
    const root = zoneRootOf(e.object);
    if (!root) return;
    e.stopPropagation();
    const zone = ZONE_BY_NODE[root.name];
    if (zone === 'entry') {
      if (view === 'entry') enter();
    } else if (zone === 'cv') {
      window.open(CONTENT.identity.cvUrl, '_blank', 'noopener,noreferrer');
    } else if (zone === 'laptop') {
      // Easter egg : le portable du chef « boote » puis ouvre le mode classique
      sfx.tick();
      useSceneStore.getState().bootClassic();
    } else if (zone === 'duck') {
      sfx.quack();
    } else if (zone === 'bell') {
      // La sonnette de l'accueil : ding ! + squash animé en useFrame
      sfx.bell();
      bellAt.current = clockNow.current;
    } else if (zone === 'champ') {
      sfx.blup(); // le bouchon saute (enfin, presque)
    } else if (zone === 'pot') {
      sfx.blup();
    } else if (zone === 'notes') {
      // Xylophone métallique : une note par casserole + balancement
      const i = Number(root.name.split('_')[2]);
      sfx.potNote(i);
      noteHits.current[i] = clockNow.current;
    } else if (zone === 'glass') {
      // 2e instrument : les bocaux, timbre « verre » (plus aigu, cristallin)
      sfx.glassNote(Number(root.name.split('_')[2]));
    } else if (zone === 'knob') {
      // 3e instrument : le piano de cuisson tient enfin son nom — une manette,
      // une touche (pentatonique : aucune combinaison ne sonne faux).
      const i = Number(root.name.split('_')[2]);
      sfx.pianoKey(i);
      knobHits.current[i] = clockNow.current;
    } else if (zone === 'ust') {
      // 4e instrument : la barre d'ustensiles, section percussion
      const i = Number(root.name.split('_')[2]);
      sfx.utensilHit(i);
      ustHits.current[i] = clockNow.current;
    } else if (zone === 'steak') {
      // Mini-jeu : 1er clic = on lance (et on plonge sur le piano) ; pendant la
      // cuisson chaque clic RETOURNE le steak ; sur résultat, on relance.
      const g = useSteakStore.getState();
      if (view === 'overview' || zoneId !== 'steak') goFocus('steak');
      if (g.phase === 'cooking') g.flip();
      else g.start();
    } else if (zone === 'veg') {
      // Un légume = une famille de stack (couleur assortie au bac)
      const i = Number(root.name.split('_')[2]);
      setBac(i);
      sfx.tick();
      if (view === 'overview' || zoneId !== 'skills') goFocus('skills');
    } else if (zone === 'salle') {
      // On passe les portières et la caméra entre dans la salle du restaurant
      sfx.slide();
      if (view === 'overview' || zoneId !== zone) goFocus(zone);
    } else if (zone === 'lamp') {
      // On éteint / rallume la lampe du passe
      sfx.tick();
      const on = !useSceneStore.getState().lampOn;
      useSceneStore.getState().toggleLamp();
      for (const n of [nodes.lamp_bulb, nodes.lamp_shade]) {
        n?.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of [].concat(o.material)) {
            m.emissiveIntensity = on ? m.userData.origEmissive ?? 1 : 0.02;
          }
        });
      }
    } else if (zone === 'skills') {
      // Chaque bac sélectionne sa famille d'ingrédients
      setBac(Number(root.name.split('_')[2]));
      if (view === 'overview' || zoneId !== 'skills') goFocus('skills');
    } else if (zone === 'drawers') {
      if (view === 'overview' || zoneId !== 'drawers') {
        goFocus('drawers');
      } else {
        const i = Number(root.name.split('_')[2]);
        // Le 8e tiroir n'a pas de projet : c'est le tiroir secret du chef
        if (CONTENT.projects[i]) goDetail(CONTENT.projects[i].id);
        else sfx.secret();
      }
    } else if (view === 'overview' || zoneId !== zone) {
      goFocus(zone);
    }
  };

  // Le glow est peint en useFrame d'après hot.current : ici on ne fait que
  // pointer la racine survolée (et la nettoyer). Robuste aux transitions
  // entre sous-meshes d'un même objet.
  const onPointerOver = (e) => {
    const root = zoneRootOf(e.object);
    if (!root) return;
    e.stopPropagation();
    hot.current = root;
    setHovered(ZONE_BY_NODE[root.name]);
  };

  const onPointerOut = (e) => {
    const root = zoneRootOf(e.object);
    // Ne nettoyer que si on quitte réellement la racine survolée
    if (root && root === hot.current) {
      hot.current = null;
      setHovered(null);
    }
  };

  return (
    <group>
      {/* Le poste entier, généré par Blender */}
      <primitive object={scene} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut} />

      {/* Le piano vit : vapeur de la marmite et de la sauteuse,
          lueur orange vacillante des feux et du four */}
      <Steam
        position={[L.piano.x + L.piano.burners[0][0] + 0.02, 1.27, L.piano.z + L.piano.burners[0][1]]}
        count={6}
        size={0.042}
        height={0.5}
      />
      {/* Le grésil du steak : la vapeur ne monte QUE pendant la cuisson (un
          steak cru posé dans la poêle ne fume pas) */}
      {steakPhase === 'cooking' && (
        <Steam position={STEAK_POS} count={7} size={0.028} height={0.36} speed={0.5} />
      )}
      <pointLight
        ref={stoveLight}
        position={[L.piano.x, 1.15, L.piano.z + 0.2]}
        color="#ff8c3a"
        intensity={0.6}
        distance={1.8}
      />

      {/* Spot chaud du mode detail : braqué sur le tiroir ouvert (intensité animée) */}
      <spotLight
        ref={spotRef}
        target={spotTarget}
        angle={0.42}
        penumbra={0.7}
        distance={5}
        intensity={0}
        color="#ffdcae"
      />
      <primitive object={spotTarget} />

      {/* Sol et mur carrelés (restent côté R3F : répétition de texture triviale) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={NO_RAYCAST} receiveShadow>
        <planeGeometry args={[L.floor.size, L.floor.size]} />
        <meshStandardMaterial map={floorTex} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, L.wall.h / 2, L.wall.z]} raycast={NO_RAYCAST} receiveShadow>
        <planeGeometry args={[L.wall.w, L.wall.h]} />
        <meshStandardMaterial map={wallTex} roughness={0.35} metalness={0.02} />
      </mesh>
      {/* Mur latéral gauche : plein (la chambre froide n'existe plus) */}
      <mesh
        position={[-L.sideWalls.x, L.wall.h / 2, 2.05]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={NO_RAYCAST}
        receiveShadow
      >
        <planeGeometry args={[5.2, L.wall.h]} />
        <meshStandardMaterial map={sideTex} roughness={0.35} metalness={0.02} />
      </mesh>
      {/* Mur latéral droit : PERCÉ — on aperçoit la salle chaude à travers
          le passage à portières (encadrement modélisé dans le GLB) */}
      {sideSegsR.map((sg, i) => (
        <mesh
          key={i}
          position={[L.sideWalls.x, (sg.y0 + sg.y1) / 2, (sg.z0 + sg.z1) / 2]}
          rotation={[0, -Math.PI / 2, 0]}
          raycast={NO_RAYCAST}
          receiveShadow
        >
          <planeGeometry args={[sg.z1 - sg.z0, sg.y1 - sg.y0]} />
          <meshStandardMaterial map={sg.tex} roughness={0.35} metalness={0.02} />
        </mesh>
      ))}
      {/* Plafond sombre : ferme le volume, plus de vide noir en levant les yeux */}
      <mesh position={[0, L.ceiling.y, 1.5]} rotation={[Math.PI / 2, 0, 0]} raycast={NO_RAYCAST}>
        <planeGeometry args={[L.floor.size, L.floor.size]} />
        <meshStandardMaterial color="#1e1e23" roughness={0.95} />
      </mesh>

      {/* Fiche projet : bon de commande POSÉ dans l'espace 3D, incliné sur le
          tiroir ouvert (Html transform = le DOM suit la perspective) */}
      {openProject && openIndex >= 0 && (
        <Html
          transform
          position={[
            drawerPos(openIndex).x,
            drawerPos(openIndex).y + 0.11,
            L.drawers.z + L.drawers.slide + 0.03,
          ]}
          rotation={[-0.5, 0, 0]}
          distanceFactor={0.3 * dfRatio}
        >
          <div className="ticket-tilt" {...tiltHandlers(14)}>
            <article className="ticket ticket-3d" role="dialog" aria-label={openProject.title}>
            <TicketBody kicker="Bon de commande" title={openProject.title} num={`N°0${openIndex + 1}`}>
              <ProjectThumb project={openProject} accent={BAC_COLORS[openIndex % BAC_COLORS.length]} />
              <p className="stamp">{openProject.course}</p>
              <p>{openProject.desc}</p>
              <p className="ticket-note">« {openProject.note} »</p>
              <Chips items={openProject.tech} />
              <div className="ticket-actions">
                <a className="ticket-link" href={openProject.url} target="_blank" rel="noreferrer">
                  Voir le projet ↗
                </a>
                <button onClick={() => goFocus('drawers')}>Refermer le tiroir</button>
              </div>
            </TicketBody>
            </article>
          </div>
        </Html>
      )}

      {/* Les Ingrédients — la saladette : panneau docké en DOM, cf. Overlay.jsx
          (ne s'enfonce jamais sous le bas de l'écran comme le faisait
          l'ancienne version projetée en 3D). */}

      {/* Service ! — contact au passe (les réservations vivent en salle).
          Contenu partagé avec le dock mobile : cf. ui/ContactPanel.jsx. */}
      <FocusPanel zoneId="pass" position={[L.pass.x, L.pass.shelfY - 0.02, L.pass.z + 0.15]}>
        <ContactPanel />
      </FocusPanel>

      {/* La Brigade — états de service sur le tableau.
          Contenu partagé avec le dock mobile : cf. ui/BoardPanel.jsx. */}
      <FocusPanel zoneId="board" position={[L.board.x + 0.61, L.board.y - 0.02, L.board.z + 0.3]}>
        <BoardPanel />
      </FocusPanel>

      {/* Le Chef — récit de reconversion.
          Contenu partagé avec le dock mobile : cf. ui/ChefPanel.jsx. */}
      <FocusPanel zoneId="shelf" position={[L.book.x - 0.42, L.shelf.y + 0.05, L.shelf.z + 0.2]}>
        <ChefPanel />
      </FocusPanel>

      {/* La Salle — le restaurant : accueil du maître d'hôtel, parcours,
          réservation (contact) et livre d'or */}

      {/* Pastilles « où cliquer » : uniquement en vue d'ensemble */}
      {view === 'overview' && <Hotspots />}
    </group>
  );
}

// Panneau ancré en 3D (Html center) : board/pass/shelf. Sur écran étroit, ce
// ticket quasi pleine largeur déborde d'un côté dès que son ancrage 3D n'est
// pas pile centré (retours UX : texte tronqué à gauche/droite) — le dock
// mobile équivalent (Overlay.jsx, contenu partagé via ui/BoardPanel.jsx etc.)
// prend le relais ; `.ticket-3d-anchor` masque celui-ci en dessous de 560px
// (cf. media query mobile de styles.css), les deux ne sont jamais visibles
// en même temps.
function FocusPanel({ zoneId, position, children }) {
  const view = useSceneStore((s) => s.view);
  const current = useSceneStore((s) => s.zoneId);
  if (view === 'overview' || current !== zoneId) return null;
  return (
    <Html position={position} center>
      <article className="ticket ticket-3d-anchor">{children}</article>
    </Html>
  );
}

useGLTF.preload(MODEL);
