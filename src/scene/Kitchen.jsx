import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor, useGLTF } from '@react-three/drei';
import { Object3D } from 'three';
import { easing } from 'maath';
import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';
import { LAYOUT as L } from './layout';
import { makeSubwayTexture, makeFloorTexture, makeTerminal, SUBWAY_PERIOD, FLOOR_PERIOD } from './textures';
import { tiltHandlers } from '../ui/tilt';
import { sfx } from '../audio/sfx';

const MODEL = '/models/poste.glb';
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
for (let i = 0; i < 6; i++) ZONE_BY_NODE[`zone_drawer_${i}`] = 'drawers';
for (let i = 0; i < 5; i++) ZONE_BY_NODE[`zone_bac_${i}`] = 'skills';
for (let i = 0; i < 4; i++) ZONE_BY_NODE[`zone_note_${i}`] = 'notes';
for (let i = 0; i < 5; i++) ZONE_BY_NODE[`zone_veg_${i}`] = 'veg';
for (let i = 0; i < 2; i++) ZONE_BY_NODE[`zone_glass_${i}`] = 'glass';

// Une couleur par famille de stack (mêmes teintes que bacs et légumes)
const BAC_COLORS = ['#c0392b', '#5a8a3c', '#c8a636', '#a89a7c', '#c9762e'];

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

// Position façade du tiroir i (grille 3 colonnes × 2 rangées)
const drawerPos = (i) => ({
  x: L.drawers.cols[i % 3],
  y: L.drawers.rows[Math.floor(i / 3)],
});

// Un objet Blender multi-matériaux arrive dans three.js comme un Group
// contenant un mesh par matériau : on remonte jusqu'à la racine "zone_*".
function zoneRootOf(object) {
  let o = object;
  while (o && !(o.name in ZONE_BY_NODE)) o = o.parent;
  return o ?? null;
}

// Matériaux dont l'émission fait partie du design : exclus du glow hover
const NO_GLOW = new Set(['laptop_screen', 'lamp_bulb', 'lamp_shade']);

// Décor suspendu au mur (batterie de cuivre, ustensiles, bocaux, herbes) :
// on coupe leur projection d'ombre — leur silhouette dure sur le carrelage
// était l'« ombre moche ». Ils sont sur des barres → pas d'ombre de contact utile.
const NO_WALL_SHADOW = /note_|potrail|utrail|utensils|louche|ecumoire|spatule|fouet|jar_|zone_glass|herb|piano_pan|piano_saucepan/;
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
  useCursor(!!hovered);
  const hot = useRef(null); // zone actuellement survolée (racine GLB)
  const zoneRoots = useRef([]); // toutes les racines interactives (glow par frame)
  const doorVel = useRef({ L: 0, R: 0 }); // vitesses angulaires des battants
  const spotRef = useRef();
  const stoveLight = useRef();
  const spotTarget = useMemo(() => new Object3D(), []);
  const noteHits = useRef([-99, -99, -99, -99]); // instants de frappe (xylophone)
  const bellAt = useRef(-99); // instant du dernier coup de sonnette
  const clockNow = useRef(0);
  const term = useRef(null); // terminal animé du laptop
  const lastTerm = useRef(0);

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

    // Glow de survol dérivé de hot.current CHAQUE frame → jamais « bloqué »
    // (auto-réparant : si un pointerout est manqué, l'état se recorrige seul).
    for (const root of zoneRoots.current) {
      const target = root === hot.current ? 0.32 : 0;
      root.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (!m.userData.noGlow) easing.damp(m, 'emissiveIntensity', target, 0.08, step);
        }
      });
    }

    CONTENT.projects.forEach((p, i) => {
      const node = nodes[`zone_drawer_${i}`];
      if (!node) return;
      // rush = « coup de feu » (code Konami) : tous les tiroirs s'ouvrent
      const open = rush || (view === 'detail' && projectId === p.id);
      // Au survol en vue focus, le tiroir s'entrouvre — invite au clic
      const peek = !open && zoneId === 'drawers' && hotName === `zone_drawer_${i}` ? 0.06 : 0;
      easing.damp(node.position, 'z', L.drawers.z + (open ? L.drawers.slide : peek), 0.25, step);
    });

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
    const t = _.clock.elapsedTime;
    clockNow.current = t;
    // En dev : scène + caméra exposées pour les scripts de validation (tools/)
    if (import.meta.env.DEV) {
      window.__scene = _.scene;
      window.__cam = _.camera;
    }
    for (let i = 0; i < 4; i++) {
      const n = nodes[`flame_${i}`];
      if (!n) continue;
      n.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          m.emissiveIntensity = 1.9 + Math.sin(t * 13 + i * 2.4) * 0.5 + Math.sin(t * 31 + i) * 0.3;
        }
      });
    }
    if (nodes.oven_glow) {
      nodes.oven_glow.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          m.emissiveIntensity = 1.4 + Math.sin(t * 7) * 0.25 + Math.sin(t * 23) * 0.15;
        }
      });
    }
    if (stoveLight.current) {
      stoveLight.current.intensity = 0.6 + Math.sin(t * 15) * 0.12 + Math.sin(t * 37) * 0.07;
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
        goDetail(CONTENT.projects[i].id);
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
      <Steam
        position={[L.piano.x + L.piano.burners[3][0], 1.06, L.piano.z + L.piano.burners[3][1]]}
        count={4}
        size={0.03}
        height={0.32}
        speed={0.38}
      />
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
          distanceFactor={0.3}
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

      {/* Les Ingrédients — la saladette, un bac par famille */}
      <FocusPanel zoneId="skills" position={[L.saladette.x + 0.42, 1.12, 0.2]}>
        <TicketBody kicker="Les Ingrédients" title="La saladette" footer="produits frais · maison">
          <div className="bac-tabs" role="tablist">
            {CONTENT.skills.map((s, i) => (
              <button
                key={s.bac}
                role="tab"
                aria-selected={i === bacIndex}
                className={i === bacIndex ? 'on' : ''}
                style={
                  i === bacIndex
                    ? { background: BAC_COLORS[i], borderColor: BAC_COLORS[i], color: '#fdf9ef' }
                    : { borderColor: BAC_COLORS[i], color: '#4a423a' }
                }
                onClick={() => setBac(i)}
              >
                {s.bac}
              </button>
            ))}
          </div>
          <h3 style={{ color: BAC_COLORS[bacIndex] }}>{CONTENT.skills[bacIndex].poste}</h3>
          <Chips items={CONTENT.skills[bacIndex].items} color={BAC_COLORS[bacIndex]} />
          <p className="ticket-note">
            Chaque bac de la saladette est cliquable — comme les légumes du billot.
          </p>
        </TicketBody>
      </FocusPanel>

      {/* Service ! — contact au passe (les réservations vivent en salle) */}
      <FocusPanel zoneId="pass" position={[L.pass.x, L.pass.shelfY - 0.02, L.pass.z + 0.15]}>
        <TicketBody kicker="— Service ! —" title="Le chef répond au passe" footer="réponse sous 24 h · lyon">
          <p>{CONTENT.contact.pitch}</p>
          <div className="contact-list">
            <p className="contact-row">
              <span className="contact-k">✉ Email</span>
              <a href={`mailto:${CONTENT.contact.email}`}>{CONTENT.contact.email}</a>
            </p>
            <p className="contact-row">
              <span className="contact-k">☎ Tél</span>
              <a href={`tel:+33${CONTENT.contact.telHref.slice(1)}`}>{CONTENT.contact.tel}</a>
            </p>
            <p className="contact-row">
              <span className="contact-k">⌥ GitHub</span>
              <a href={CONTENT.contact.github.url} target="_blank" rel="noreferrer">
                {CONTENT.contact.github.handle}
              </a>
            </p>
            <p className="contact-row">
              <span className="contact-k">in LinkedIn</span>
              <a href={CONTENT.contact.linkedin.url} target="_blank" rel="noreferrer">
                {CONTENT.contact.linkedin.handle}
              </a>
            </p>
            <p className="contact-row">
              <span className="contact-k">⎙ CV</span>
              <a href={CONTENT.identity.cvUrl} download>
                CV_Noa_Vellat.pdf
              </a>
            </p>
          </div>
          <p className="ticket-note">
            ⚠ Allergènes : bugs, code non testé &amp; deadlines floues — jamais
            servis dans cette maison.
          </p>
          <p className="stamp stamp-green">{CONTENT.identity.dispo}</p>
        </TicketBody>
      </FocusPanel>

      {/* La Brigade — états de service sur le tableau */}
      <FocusPanel zoneId="board" position={[L.board.x + 0.47, L.board.y - 0.05, L.board.z + 0.3]}>
        <TicketBody kicker="La Brigade" title="États de service" footer="ancienneté vérifiée">
          <ul className="timeline">
            {CONTENT.about.timeline.map((t) => (
              <li key={t.year}>
                <strong>{t.year}</strong>
                <span className="timeline-role">{t.title}</span> — {t.sub}
                {t.detail && <em className="ticket-detail">{t.detail}</em>}
              </li>
            ))}
          </ul>
          <Chips items={CONTENT.about.tags} />
        </TicketBody>
      </FocusPanel>

      {/* Le Chef — récit de reconversion */}
      <FocusPanel zoneId="shelf" position={[L.book.x - 0.42, L.shelf.y + 0.05, L.shelf.z + 0.2]}>
        <TicketBody kicker="Le Chef" title="De la brigade au terminal" footer="recette de la maison">
          {CONTENT.about.paras.map((p) => (
            <p key={p.slice(0, 16)}>{p}</p>
          ))}
          <p className="ticket-note">« {CONTENT.about.quote} »</p>
        </TicketBody>
      </FocusPanel>

      {/* La Salle — le restaurant : accueil du maître d'hôtel, parcours,
          réservation (contact) et livre d'or */}
    </group>
  );
}

function FocusPanel({ zoneId, position, children }) {
  const view = useSceneStore((s) => s.view);
  const current = useSceneStore((s) => s.zoneId);
  if (view === 'overview' || current !== zoneId) return null;
  return (
    <Html position={position} center>
      <article className="ticket">{children}</article>
    </Html>
  );
}

// Habillage commun des bons : en-tête de la maison, numéro fantôme,
// code-barres et pied de ticket — la DA « ticket thermique ».
function TicketBody({ kicker, title, num, children, footer = 'le poste · service continu' }) {
  return (
    <>
      <header className="ticket-head">
        <p className="ticket-brand">◆ Le Poste — cuisine du chef ◆</p>
        {num && <span className="ticket-num">{num}</span>}
        <p className="ticket-kicker">{kicker}</p>
        <h2>{title}</h2>
      </header>
      {children}
      <div className="barcode" aria-hidden="true" />
      <p className="ticket-foot">{footer}</p>
    </>
  );
}

function Chips({ items, color }) {
  const style = color ? { borderColor: color, color, background: `${color}14` } : undefined;
  return (
    <div className="chips">
      {items.map((t) => (
        <span className="chip" key={t} style={style}>
          {t}
        </span>
      ))}
    </div>
  );
}

useGLTF.preload(MODEL);
