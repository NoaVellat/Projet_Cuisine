import { Vector3 } from 'three';
import { LAYOUT } from './layout';

const { drawers, pass, board, shelf, book, saladette, counter, worktop } = LAYOUT;

// POI = point d'intérêt caméra : une position + une cible de regard.
// Dérivés de LAYOUT pour rester alignés si les proportions bougent.
export const POIS = {
  entry: {
    // Dans le couloir, assez de recul pour cadrer portes + enseigne
    pos: new Vector3(0, 1.6, LAYOUT.entry.z + 2.5),
    target: new Vector3(0, 1.55, LAYOUT.entry.z),
  },
  overview: {
    // Cadre tout le poste sans reculer trop (au-delà, le parallax rasait les
    // murs latéraux et révélait le vide sur les côtés).
    pos: new Vector3(-0.15, 1.64, 4.0),
    target: new Vector3(-0.15, 1.2, -0.05),
  },
  drawers: {
    // Assez de recul pour cadrer les 2 rangées de 3 tiroirs (façade ~2 m, fov 45°)
    pos: new Vector3(0, 1.02, 1.95),
    target: new Vector3(0, (drawers.rows[0] + drawers.rows[1]) / 2, drawers.z),
  },
  pass: {
    pos: new Vector3(pass.x, 1.42, 1.15),
    target: new Vector3(pass.x, pass.shelfY, pass.z),
  },
  skills: {
    // Plongée au-dessus de la saladette : les 5 bacs et leurs étiquettes,
    // ET le billot (mise en place, juste devant) dans le même cadre.
    // Reculée + fov resserré (32° au lieu de 45°) : moins de distorsion de
    // grand-angle rapproché, cadre plus large sans agrandir démesurément
    // ce qui est proche de la caméra. Translatée vers la gauche (pos ET
    // target) pour dégager le bac SOFT (le 5e, à droite) de sous le
    // panneau docké — translation pure, pas de rotation, pour garder la
    // rangée bien horizontale à l'écran.
    pos: new Vector3(saladette.x + 0.1, 2.72, 2.10),
    target: new Vector3(saladette.x + 0.1, 1.08, 0.02),
    fov: 32,
  },
  board: {
    // Reculée pour cadrer le tableau agrandi + le ticket DOM docké à droite
    pos: new Vector3(board.x, board.y, 1.05),
    target: new Vector3(board.x, board.y, board.z),
  },
  shelf: {
    // Cadré sur le livre, pas sur le centre de l'étagère
    pos: new Vector3(book.x, shelf.y + 0.15, 0.95),
    target: new Vector3(book.x, shelf.y + 0.05, shelf.z),
  },
  // Plongée vers l'écran du portable pendant la séquence de boot (easter egg
  // → mode classique) : la caméra « entre dans la machine ».
  laptop: {
    pos: new Vector3(0.72, 1.34, 1.62),
    target: new Vector3(LAYOUT.laptop.x, 1.05, LAYOUT.laptop.z - 0.09),
  },
  // Mini-jeu du steak : plongée serrée sur la poêle du feu avant-droit du piano
  // (le steak y grésille). Cadrée à gauche/haut pour laisser le HUD-ticket docké
  // à droite. Le steak est en LAYOUT.piano.x + burners[3] ; on le vise de face,
  // un peu en plongée, assez près pour voir la viande changer de couleur.
  steak: (() => {
    const b = LAYOUT.piano;
    const stx = b.x + b.burners[3][0];
    const stz = b.z + b.burners[3][1];
    return {
      pos: new Vector3(stx + 0.28, 1.62, stz + 1.25),
      target: new Vector3(stx - 0.05, 1.0, stz),
      fov: 40,
    };
  })(),

  // La salle du restaurant (droite) : la caméra se pose juste passé la porte
  // et regarde la PROFONDEUR de la salle — l'allée au tapis rouge, les lustres,
  // le miroir du fond. Le maître d'hôtel accueille à gauche du cadre (le
  // panneau réservations est docké à droite en DOM).
  salle: {
    pos: new Vector3(LAYOUT.sideWalls.x + 0.3, 1.38, 1.34),
    target: new Vector3(LAYOUT.sideWalls.x + 4.0, 1.08, 1.6),
  },
};
