import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useCursor, useGLTF } from '@react-three/drei';
import { Object3D } from 'three';
import { easing } from 'maath';
import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';
import { LAYOUT as L } from './layout';
import { makeSubwayTexture, makeFloorTexture, SUBWAY_PERIOD, FLOOR_PERIOD } from './textures';

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
};
for (let i = 0; i < 6; i++) ZONE_BY_NODE[`zone_drawer_${i}`] = 'drawers';
for (let i = 0; i < 5; i++) ZONE_BY_NODE[`zone_bac_${i}`] = 'skills';

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

function setGlow(root, intensity) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) m.emissiveIntensity = intensity;
  });
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
  useCursor(!!hovered);
  const hot = useRef(null); // zone actuellement survolée (racine GLB)
  const doorVel = useRef({ L: 0, R: 0 }); // vitesses angulaires des battants
  const spotRef = useRef();
  const spotTarget = useMemo(() => new Object3D(), []);

  // Préparation du GLB, une seule fois : matériaux clonés sur les zones
  // (pour le glow hover sans affecter le décor qui partage le même inox),
  // raycast coupé sur tout le reste.
  useMemo(() => {
    scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (zoneRootOf(o)) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
        for (const m of [].concat(o.material)) {
          m.emissive.set(COPPER);
          m.emissiveIntensity = 0;
        }
      } else {
        o.raycast = NO_RAYCAST;
      }
    });
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

  const openProject = view === 'detail' ? CONTENT.projects.find((p) => p.id === projectId) : null;
  const openIndex = openProject ? CONTENT.projects.indexOf(openProject) : -1;

  // Coulissement des tiroirs, battement des portes, spot sur le projet ouvert.
  useFrame((_, delta) => {
    const step = Math.min(delta, 0.05);
    const hotName = hot.current?.name;

    CONTENT.projects.forEach((p, i) => {
      const node = nodes[`zone_drawer_${i}`];
      if (!node) return;
      const open = view === 'detail' && projectId === p.id;
      // Au survol en vue focus, le tiroir s'entrouvre — invite au clic
      const peek = !open && zoneId === 'drawers' && hotName === `zone_drawer_${i}` ? 0.06 : 0;
      easing.damp(node.position, 'z', L.drawers.z + (open ? L.drawers.slide : peek), 0.25, delta);
    });

    // Battants : ressort sous-amorti → ils dépassent puis se stabilisent,
    // constantes différentes gauche/droite pour un décalage naturel.
    const opened = view !== 'entry';
    const swing = (node, key, target, k, c) => {
      if (!node) return;
      doorVel.current[key] += (k * (target - node.rotation.y) - c * doorVel.current[key]) * step;
      node.rotation.y += doorVel.current[key] * step;
    };
    swing(nodes.door_L, 'L', opened ? 1.9 : 0, 26, 5.5);
    swing(nodes.door_R, 'R', opened ? -1.9 : 0, 19, 4.8);

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
      window.open(CONTENT.identity.cvUrl, '_blank');
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

  const onPointerOver = (e) => {
    const root = zoneRootOf(e.object);
    if (!root) return;
    e.stopPropagation();
    if (hot.current && hot.current !== root) setGlow(hot.current, 0);
    setGlow(root, 0.3);
    hot.current = root;
    setHovered(ZONE_BY_NODE[root.name]);
  };

  const onPointerOut = () => {
    if (hot.current) setGlow(hot.current, 0);
    hot.current = null;
    setHovered(null);
  };

  return (
    <group>
      {/* Le poste entier, généré par Blender */}
      <primitive object={scene} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut} />

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
          <article className="ticket ticket-3d" role="dialog" aria-label={openProject.title}>
            <p className="ticket-kicker">{openProject.course}</p>
            <h2>{openProject.title}</h2>
            <p>{openProject.desc}</p>
            <p className="ticket-note">« {openProject.note} »</p>
            <p className="ticket-chips">{openProject.tech.join(' · ')}</p>
            <a className="ticket-link" href={openProject.url} target="_blank" rel="noreferrer">
              Voir le projet ↗
            </a>
            <button onClick={() => goFocus('drawers')}>Refermer le tiroir</button>
          </article>
        </Html>
      )}

      {/* Les Ingrédients — la saladette, un bac par famille */}
      <FocusPanel zoneId="skills" position={[L.saladette.x + 0.42, 1.12, 0.2]}>
        <p className="ticket-kicker">Les Ingrédients</p>
        <h2>La saladette</h2>
        <div className="bac-tabs" role="tablist">
          {CONTENT.skills.map((s, i) => (
            <button
              key={s.bac}
              role="tab"
              aria-selected={i === bacIndex}
              className={i === bacIndex ? 'on' : ''}
              onClick={() => setBac(i)}
            >
              {s.bac}
            </button>
          ))}
        </div>
        <h3>{CONTENT.skills[bacIndex].poste}</h3>
        <p className="ticket-chips">{CONTENT.skills[bacIndex].items.join(' · ')}</p>
        <p className="ticket-note">Chaque bac de la saladette est cliquable.</p>
      </FocusPanel>

      {/* Réservations — contact au passe */}
      <FocusPanel zoneId="pass" position={[L.pass.x, L.pass.shelfY - 0.02, L.pass.z + 0.15]}>
        <p className="ticket-kicker">Réservations</p>
        <h2>Service au passe</h2>
        <p>{CONTENT.contact.pitch}</p>
        <ul>
          <li><a href={`mailto:${CONTENT.contact.email}`}>{CONTENT.contact.email}</a></li>
          <li><a href={`tel:+33${CONTENT.contact.telHref.slice(1)}`}>{CONTENT.contact.tel}</a></li>
          <li><a href={CONTENT.contact.github.url} target="_blank" rel="noreferrer">GitHub — {CONTENT.contact.github.handle}</a></li>
          <li><a href={CONTENT.contact.linkedin.url} target="_blank" rel="noreferrer">LinkedIn — {CONTENT.contact.linkedin.handle}</a></li>
          <li><a href={CONTENT.identity.cvUrl} download>Télécharger le CV</a></li>
        </ul>
        <p className="ticket-note">{CONTENT.identity.dispo}</p>
      </FocusPanel>

      {/* La Brigade — états de service sur le tableau */}
      <FocusPanel zoneId="board" position={[L.board.x + 0.18, L.board.y - 0.03, L.board.z + 0.25]}>
        <p className="ticket-kicker">La Brigade</p>
        <h2>États de service</h2>
        <ul className="ticket-timeline">
          {CONTENT.about.timeline.map((t) => (
            <li key={t.year}>
              <strong>{t.year}</strong> {t.title} — {t.sub}
              {t.detail && <em className="ticket-detail">{t.detail}</em>}
            </li>
          ))}
        </ul>
        <p className="ticket-chips">{CONTENT.about.tags.join(' · ')}</p>
      </FocusPanel>

      {/* Le Chef — récit de reconversion */}
      <FocusPanel zoneId="shelf" position={[L.book.x - 0.42, L.shelf.y + 0.05, L.shelf.z + 0.2]}>
        <p className="ticket-kicker">Le Chef</p>
        <h2>De la brigade au terminal</h2>
        {CONTENT.about.paras.map((p) => (
          <p key={p.slice(0, 16)}>{p}</p>
        ))}
        <p className="ticket-note">« {CONTENT.about.quote} »</p>
      </FocusPanel>
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

useGLTF.preload(MODEL);
