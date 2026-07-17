import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { easing } from 'maath';
import { useSceneStore } from '../store/useSceneStore';
import { CONTENT } from '../content/content';
import { POIS } from './pois';
import { LAYOUT } from './layout';

const LOOK = new Vector3();

// POI dynamique du mode detail : la caméra plonge vers le tiroir ouvert.
// Vecteurs réutilisés → zéro allocation par frame.
const DETAIL = { pos: new Vector3(), target: new Vector3() };

function detailPoi(projectId) {
  const i = CONTENT.projects.findIndex((p) => p.id === projectId);
  const D = LAYOUT.drawers;
  const x = D.cols[i % D.cols.length] ?? 0;
  const y = D.rows[Math.floor(i / D.cols.length)] ?? D.rows[0];
  DETAIL.pos.set(x, y + 0.42, 1.32);
  DETAIL.target.set(x, y + 0.02, D.z + 0.07);
  return DETAIL;
}

export function CameraRig() {
  const view = useSceneStore((s) => s.view);
  const zoneId = useSceneStore((s) => s.zoneId);
  const projectId = useSceneStore((s) => s.projectId);
  const booting = useSceneStore((s) => s.booting);
  const currentTarget = useRef(POIS.entry.target.clone());

  const { parallaxScale, smoothTime } = useMemo(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    return {
      // ×1.6 sur touch pour compenser l'absence de hover ; 0 si reduced-motion
      parallaxScale: reduced ? 0 : coarse ? 1.6 : 1,
      smoothTime: reduced ? 0.12 : 0.45,
    };
  }, []);

  useFrame((state, delta) => {
    // Boot du laptop : la caméra plonge sur l'écran, priorité sur tout le reste
    const poi = booting
      ? POIS.laptop
      : view === 'detail' && zoneId === 'drawers'
        ? detailPoi(projectId)
        : view === 'entry' || view === 'overview'
          ? POIS[view]
          : POIS[zoneId] ?? POIS.overview;

    // Parallax souris : en overview (tête qui tourne) et atténué dans le couloir
    const pAmp = booting ? 0 : view === 'overview' ? 1 : view === 'entry' ? 0.45 : 0;
    // px volontairement contenu : au-delà, le parallax rasait les murs
    // latéraux et révélait le vide sur les côtés.
    const px = state.pointer.x * 0.16 * parallaxScale * pAmp;
    const py = state.pointer.y * 0.12 * parallaxScale * pAmp;

    // Traversée des portes : damping un peu plus lent pour laisser les
    // battants s'ouvrir devant la caméra ; plongée laptop = dolly rapide et net
    const st = booting ? 0.26 : view === 'overview' ? smoothTime * 1.35 : smoothTime;

    // Position : damping exponentiel, indépendant du framerate
    easing.damp3(
      state.camera.position,
      [poi.pos.x + px, poi.pos.y + py, poi.pos.z],
      st,
      delta
    );

    // Cible de regard : dampée séparément pour un mouvement organique
    easing.damp3(currentTarget.current, poi.target, st * 0.9, delta);
    LOOK.copy(currentTarget.current);
    state.camera.lookAt(LOOK);
  });

  return null;
}
