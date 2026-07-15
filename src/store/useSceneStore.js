import { create } from 'zustand';

export const useSceneStore = create((set) => ({
  view: 'entry',           // 'entry' | 'overview' | 'focus' | 'detail'
  zoneId: null,            // 'drawers' | 'pass' | 'board' | 'shelf'
  projectId: null,
  hovered: null,           // zoneId survolée (curseur + outline)
  quality: 'high',         // 'high' | 'low' — piloté par PerformanceMonitor
  bacIndex: 0,             // bac sélectionné dans la saladette (zone skills)
  muted: false,            // bruitages (initialisés au premier geste)
  classic: false,          // mode classique (bouton HUD ou laptop easter egg)
  booting: false,          // séquence de boot du laptop avant le mode classique
  lampOn: true,            // lampe du passe (cliquable)
  rush: false,             // « coup de feu » : code Konami → tous les tiroirs
  enter: () => set({ view: 'overview' }),   // pousse les portes battantes
  setBac: (bacIndex) => set({ bacIndex }),
  setMuted: (muted) => set({ muted }),
  setClassic: (classic) => set({ classic }),
  // Le laptop « boote » (overlay ~1.1 s) puis bascule en mode classique
  bootClassic: () => {
    set({ booting: true });
    setTimeout(() => set({ booting: false, classic: true }), 1100);
  },
  toggleLamp: () => set((s) => ({ lampOn: !s.lampOn })),
  setRush: (rush) => set({ rush }),
  goOverview: () => set({ view: 'overview', zoneId: null, projectId: null }),
  goFocus: (zoneId) => set({ view: 'focus', zoneId, projectId: null }),
  goDetail: (projectId) => set({ view: 'detail', projectId }),
  setHovered: (hovered) => set({ hovered }),
  setQuality: (quality) => set({ quality }),
}));

// Remonte d'un état : detail → focus → overview.
export function goBack() {
  const { view, zoneId, goFocus, goOverview } = useSceneStore.getState();
  if (view === 'detail') goFocus(zoneId);
  else if (view === 'focus') goOverview();
}
