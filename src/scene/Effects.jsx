import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import { useSceneStore } from '../store/useSceneStore';

// Post-processing léger, coupé net en qualité 'low' (PerformanceMonitor).
// SMAA remplace le MSAA (antialias: false sur le canvas) : moins cher à DPR élevé.
// Le bloom ne mord que sur les émissifs forts (lampe, rampe de hotte).
export function Effects() {
  const quality = useSceneStore((s) => s.quality);
  if (quality === 'low') return null;
  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      <Bloom mipmapBlur intensity={0.4} luminanceThreshold={0.9} luminanceSmoothing={0.2} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
