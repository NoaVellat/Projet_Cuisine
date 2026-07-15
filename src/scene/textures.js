// Textures de carrelage générées en canvas 2D au chargement : zéro téléchargement,
// zéro asset à gérer, et la répétition (RepeatWrapping) couvre n'importe quelle surface.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function makeCanvasTexture(draw, size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Carrelage métro blanc en quinconce. La texture représente une période de
// 2 tuiles × 2 rangées (tuile 15 × 7,5 cm en scène → période 0,30 × 0,15 m).
export const SUBWAY_PERIOD = { w: 0.3, h: 0.15 };

export function makeSubwayTexture() {
  return makeCanvasTexture((ctx, s) => {
    const tw = s / 2;
    const th = s / 2;
    ctx.fillStyle = '#b3b0a8'; // joints
    ctx.fillRect(0, 0, s, s);
    const tile = (x, y) => {
      const g = ctx.createLinearGradient(x, y, x + tw, y + th);
      g.addColorStop(0, '#edebe5');
      g.addColorStop(1, '#dcd9d1');
      ctx.fillStyle = g;
      ctx.fillRect(x + 3, y + 3, tw - 6, th - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; // reflet en haut de tuile
      ctx.fillRect(x + 3, y + 3, tw - 6, 9);
    };
    tile(0, 0);
    tile(tw, 0);
    // rangée du bas décalée d'une demi-tuile (pose en quinconce)
    tile(-tw / 2, th);
    tile(tw / 2, th);
    tile(s - tw / 2, th);
  });
}

// Sol : grandes dalles grises 40 cm avec légère variation de teinte par dalle.
export const FLOOR_PERIOD = 0.8; // 2 × 2 dalles par texture

export function makeFloorTexture() {
  return makeCanvasTexture((ctx, s) => {
    ctx.fillStyle = '#2e2e33'; // joints
    ctx.fillRect(0, 0, s, s);
    const tz = s / 2;
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const shade = 74 + ((i * 3 + j * 5 + 2) % 4) * 7;
        ctx.fillStyle = `rgb(${shade},${shade},${shade + 5})`;
        ctx.fillRect(i * tz + 2, j * tz + 2, tz - 4, tz - 4);
      }
    }
  });
}
