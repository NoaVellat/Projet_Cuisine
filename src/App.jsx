import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, Environment, Lightformer, Html, useProgress } from '@react-three/drei';
import { CameraRig } from './scene/CameraRig';
import { Kitchen } from './scene/Kitchen';
import { Effects } from './scene/Effects';
import { Overlay } from './ui/Overlay';
import { ClassicMode } from './ui/ClassicMode';
import { useSceneStore, goBack } from './store/useSceneStore';
import { initAudio, setAudioMuted, sfx } from './audio/sfx';

// Accès au store depuis la console / les outils de capture, en dev uniquement.
if (import.meta.env.DEV) window.__sceneStore = useSceneStore;

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="loader" role="status" aria-label="Chargement">
        <p className="loader-title">Mise en place en cours…</p>
        <div className="loader-bar">
          <span style={{ width: `${progress}%` }} />
        </div>
        <p className="loader-pct">{progress.toFixed(0)} %</p>
      </div>
    </Html>
  );
}

export default function App() {
  const [classic, setClassic] = useState(false);
  const quality = useSceneStore((s) => s.quality);
  const setQuality = useSceneStore((s) => s.setQuality);
  // Écran tactile : DPR plafonné plus bas (budget GPU mobile, cf. brief)
  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') goBack();
      // Entrée pousse les portes (seulement hors élément focusé, pour ne pas
      // interférer avec les boutons)
      if (e.key === 'Enter' && e.target === document.body) {
        const s = useSceneStore.getState();
        if (s.view === 'entry') s.enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Orchestration sonore : un seul endroit écoute les transitions d'état.
  // L'AudioContext naît au premier geste (clic/Entrée → enter), les navigateurs l'exigent.
  useEffect(() => {
    return useSceneStore.subscribe((s, prev) => {
      if (s.muted !== prev.muted) setAudioMuted(s.muted);
      if (s.view === prev.view) return;
      if (prev.view === 'entry') {
        initAudio();
        sfx.whoosh();                    // les battants
        setTimeout(() => sfx.bell(), 1200); // la cloche du passe à l'arrivée
      } else if (s.view === 'detail' || prev.view === 'detail') {
        sfx.slide();                     // tiroir qui coulisse
      } else {
        sfx.tick();                      // navigation entre zones
      }
    });
  }, []);

  if (classic) return <ClassicMode onBack={() => setClassic(false)} />;

  return (
    <>
      <Canvas
        shadows
        dpr={quality === 'low' ? 1 : coarse ? [1, 1.5] : [1, 1.75]}
        camera={{ fov: 45, position: [0, 1.6, 7.05] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onPointerMissed={goBack}
      >
        <color attach="background" args={['#141417']} />
        {/* Brouillard discret : de la profondeur au couloir et aux recoins */}
        <fog attach="fog" args={['#141417', 7.5, 16]} />
        <PerformanceMonitor
          onDecline={() => setQuality('low')}
          onIncline={() => setQuality('high')}
        >
          {/* Éclairage temps réel provisoire — remplacé par des lightmaps bakées en P3.
              Key froide plongeante (néons de cuisine) + fill + chaleur de la lampe du passe. */}
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[2, 3, 2]}
            intensity={1.3}
            castShadow={quality === 'high'}
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0004}
            shadow-camera-left={-2.8}
            shadow-camera-right={2.8}
            shadow-camera-top={3.2}
            shadow-camera-bottom={-0.5}
            shadow-camera-near={0.5}
            shadow-camera-far={10}
          />
          <directionalLight position={[-2, 1.5, 3]} intensity={0.35} />
          <pointLight position={[0.85, 1.42, -0.05]} intensity={1.3} color="#ffb066" />
          <pointLight position={[0, 1.85, 0.3]} intensity={0.5} color="#ffd9a0" />
          {/* Applique du couloir : éclaire l'enseigne et les portes à l'arrivée */}
          <pointLight position={[0, 2.3, 5.6]} intensity={1.6} color="#ffc98a" />

          {/* Env map générée localement (aucun asset réseau) : ce que l'inox reflète */}
          <Environment resolution={64} frames={1}>
            <Lightformer intensity={1.6} color="#ffb480" position={[0.9, 2.5, 0]} rotation-x={Math.PI / 2} scale={[2, 1.5, 1]} />
            <Lightformer intensity={0.8} color="#cfd8e6" position={[-3, 2, 3]} scale={[4, 2.5, 1]} />
            <Lightformer intensity={0.8} color="#ffffff" position={[0, 1.6, 4.5]} scale={[5, 2.5, 1]} />
            {/* Plafonnier diffus (néons de cuisine) pour que l'inox ne reflète pas du vide */}
            <Lightformer intensity={1.1} color="#eef0f4" position={[0, 4, 1]} rotation-x={Math.PI / 2} scale={[6, 4, 1]} />
          </Environment>

          <Suspense fallback={<Loader />}>
            <Kitchen />
          </Suspense>
          <Effects />
        </PerformanceMonitor>
        <CameraRig />
      </Canvas>
      <Overlay onClassic={() => setClassic(true)} />
    </>
  );
}
