// Technique « Hor+ » : tous les FOV de pois.js ont été calés à l'œil en
// desktop 16:9 (1280×720). Sans correction, le même FOV vertical sur un
// écran portrait (mobile) rétrécit le champ HORIZONTAL d'autant — ça coupait
// le tableau, les tickets, les pastilles sur le côté. On garde le FOV
// horizontal de référence constant et on élargit le FOV vertical envoyé à
// la caméra quand l'écran est plus étroit que 16:9 (aspect < référence).
// Partagé entre CameraRig (fov caméra) et Kitchen (compense le distanceFactor
// du ticket-3d, qui dépend lui aussi du FOV vertical effectif).
const DEG = Math.PI / 180;
export const REF_ASPECT = 16 / 9;

export function hPlusFov(designFovDeg, aspect) {
  const designFovRad = designFovDeg * DEG;
  const hFov = 2 * Math.atan(Math.tan(designFovRad / 2) * REF_ASPECT);
  return (2 * Math.atan(Math.tan(hFov / 2) / aspect)) / DEG;
}

// Ratio de compensation pour un élément Html distanceFactor (three.js) dont
// la taille à l'écran dépend de tan(FOV vertical / 2) : sans ça, un ticket
// « transform » rétrécit visiblement sur les écrans étroits, alors que
// hPlusFov vient justement d'agrandir le FOV vertical pour ces écrans-là.
export function hPlusDistanceFactorRatio(designFovDeg, aspect) {
  const adjustedFov = hPlusFov(designFovDeg, aspect) * DEG;
  const baseFov = designFovDeg * DEG;
  return Math.tan(adjustedFov / 2) / Math.tan(baseFov / 2);
}
