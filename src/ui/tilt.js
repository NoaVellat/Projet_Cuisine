// Handlers de « tilt » : la carte s'incline vers le curseur (effet parallax 3D).
// On lit la position dans le rectangle de l'élément et on pilote deux variables
// CSS (--rx/--ry) consommées par .ticket-tilt. Zéro état React, zéro re-render.
// Partagé entre les tickets projets (3D) et le panneau réservations (salle).

// L'utilisateur préfère-t-il moins d'animation ? (on coupe le tilt)
export const REDUCED =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function tiltHandlers(max = 12) {
  if (REDUCED) return {};
  return {
    onPointerMove: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      e.currentTarget.style.setProperty('--rx', `${(-py * max).toFixed(2)}deg`);
      e.currentTarget.style.setProperty('--ry', `${(px * max).toFixed(2)}deg`);
    },
    onPointerLeave: (e) => {
      e.currentTarget.style.setProperty('--rx', '0deg');
      e.currentTarget.style.setProperty('--ry', '0deg');
    },
  };
}
