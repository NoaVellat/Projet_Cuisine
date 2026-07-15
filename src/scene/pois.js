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
    // Recul suffisant pour cadrer la hotte ET le piano à gauche
    pos: new Vector3(-0.15, 1.68, 3.95),
    target: new Vector3(-0.15, 1.22, -0.05),
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
    // Plongée au-dessus de la saladette : les 5 bacs et leurs étiquettes
    pos: new Vector3(saladette.x, 1.82, 0.78),
    target: new Vector3(saladette.x, counter.h + worktop.t + saladette.h, saladette.z),
  },
  board: {
    pos: new Vector3(board.x, board.y, 0.75),
    target: new Vector3(board.x, board.y, board.z),
  },
  shelf: {
    // Cadré sur le livre, pas sur le centre de l'étagère
    pos: new Vector3(book.x, shelf.y + 0.15, 0.95),
    target: new Vector3(book.x, shelf.y + 0.05, shelf.z),
  },
  // Salles voisines : la caméra franchit le mur (culé par l'arrière) et entre
  // vraiment dans la pièce — on voit l'intérieur, plus le carrelage.
  froid: {
    pos: new Vector3(-(LAYOUT.sideWalls.x + 0.5), 1.5, 1.15),
    target: new Vector3(-(LAYOUT.sideWalls.x + 1.4), 1.25, 1.35),
  },
  salle: {
    pos: new Vector3(LAYOUT.sideWalls.x + 0.5, 1.5, 1.15),
    target: new Vector3(LAYOUT.sideWalls.x + 1.4, 1.2, 1.35),
  },
};
