import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Musician } from '@/features/gig-demo-3d/performers';
import type { InstrumentId } from '@/features/gig-demo-3d/instrumentCatalog';
import type { StageRole } from '@/features/gig-demo-3d/liveTypes';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { STYLES, modelFile, type PlayerAppearance } from './appearance';
import { assemblePlayerModel, disposeModel, loadModelLibrary, type ModelLibrary } from './model';

interface PreviewApi { replace: (appearance: PlayerAppearance, role: StageRole, instrument?: InstrumentId, richClothing?: ResolvedEquippedClothing[]) => void; rotate: (angle: number) => void; zoom: (factor: number) => void; reset: () => void; focusHead: () => void }
export function PlayerModelPreview({ appearance, role = 'other', instrument, richClothing = [] }: { appearance: PlayerAppearance; role?: StageRole; instrument?: InstrumentId; richClothing?: ResolvedEquippedClothing[] }) {
  const canvas = useRef<HTMLCanvasElement>(null), api = useRef<PreviewApi | null>(null), latest = useRef({ appearance, role, instrument, richClothing }); latest.current = { appearance, role, instrument, richClothing };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading'), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!canvas.current) return;
    let alive = true, raf = 0, seconds = 0, last = 0, actor: Musician | null = null, equipment: T.Group | null = null, library: ModelLibrary | null = null;
    let renderer: T.WebGLRenderer | undefined, environment: T.WebGLRenderTarget | undefined, controls: OrbitControls | undefined, observer: ResizeObserver | undefined;
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(35, 1, .05, 30), element = canvas.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); if (alive) setStatus('error'); };
    const onVisibility = () => { cancelAnimationFrame(raf); last = 0; if (!document.hidden && alive) raf = requestAnimationFrame(frame); };
    const frame = (now: number) => {
      if (!alive || document.hidden) return;
      seconds += last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
      actor?.update(seconds, .55, motion.matches); controls?.update(); renderer?.render(scene, camera); raf = requestAnimationFrame(frame);
    };
    setStatus('loading');
    try {
      renderer = new T.WebGLRenderer({ canvas: element, antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
      scene.background = new T.Color('#101823'); scene.fog = new T.Fog('#101823', 5, 12);
      const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(); environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
      scene.add(new T.HemisphereLight('#cad9f0', '#253044', 1.4));
      const key = new T.SpotLight('#ffe6cd', 42, 15, .7, .8, 1.5); key.position.set(-2.5, 4.5, 4); key.target.position.set(0, 1, 0); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.normalBias = .025; scene.add(key, key.target);
      const rim = new T.DirectionalLight('#58c8f4', 2.2); rim.position.set(2, 3, -2); scene.add(rim);
      const warm = new T.DirectionalLight('#d784bc', 1.1); warm.position.set(-3, 2, -1); scene.add(warm);
      const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ color: '#1c2534', roughness: .78 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.045; floor.receiveShadow = true; scene.add(floor);
      const platform = new T.Mesh(new T.CylinderGeometry(1.18, 1.25, .08, 80), new T.MeshStandardMaterial({ color: '#303c4f', roughness: .37, metalness: .5 })); platform.position.y = -.04; platform.receiveShadow = true; scene.add(platform);
      const ring = new T.Mesh(new T.TorusGeometry(1.21, .007, 8, 96), new T.MeshStandardMaterial({ color: '#53cedb', emissive: '#2e9eb3', emissiveIntensity: 2 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.012; scene.add(ring);
      camera.position.set(2.1, 1.65, 4.8); controls = new OrbitControls(camera, element); controls.target.set(0, .92, 0); controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 2.4; controls.maxDistance = 7; controls.minPolarAngle = .55; controls.maxPolarAngle = Math.PI / 2; controls.update(); controls.saveState();
      observer = new ResizeObserver(() => { const rect = element.getBoundingClientRect(); renderer!.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer!.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix(); }); observer.observe(element);
      element.addEventListener('webglcontextlost', onLost); document.addEventListener('visibilitychange', onVisibility);
      raf = requestAnimationFrame(frame);
      void loadModelLibrary((['masculine', 'feminine'] as const).flatMap(frame => STYLES.map(style => modelFile(frame, style)))).then(loaded => {
        if (!alive) { loaded.forEach(disposeModel); return; }
        library = loaded;
        api.current = {
          replace: (value, nextRole, nextInstrument, nextRichClothing = []) => {
            if (actor) disposeModel(actor.root); if (equipment) disposeModel(equipment);
            const assembled = assemblePlayerModel(library!, value);
            actor = new Musician(assembled, nextRole, [0, 0, 0], 0, undefined, value, nextInstrument, undefined, nextRichClothing); disposeModel(assembled); scene.add(actor.root);
            equipment = actor.equipment; if(equipment)scene.add(equipment);
          },
          rotate: angle => { camera.position.sub(controls!.target).applyAxisAngle(new T.Vector3(0, 1, 0), angle).add(controls!.target); controls!.update(); },
          zoom: factor => { const offset = camera.position.clone().sub(controls!.target); offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls!.minDistance, 7)); camera.position.copy(controls!.target).add(offset); controls!.update(); },
          reset: () => { controls!.minDistance = 2.4; controls!.reset(); },
          focusHead: () => { controls!.minDistance = .65; controls!.target.set(0, 1.56 * latest.current.appearance.body.height, 0); camera.position.copy(controls!.target).add(new T.Vector3(.1, .06, 1.05)); controls!.update(); },
        };
        api.current.replace(latest.current.appearance, latest.current.role, latest.current.instrument, latest.current.richClothing); setStatus('ready');
      }).catch(() => { if (alive) setStatus('error'); });
    } catch { setStatus('error'); }
    return () => {
      alive = false; api.current = null; cancelAnimationFrame(raf); observer?.disconnect(); controls?.dispose();
      element.removeEventListener('webglcontextlost', onLost); document.removeEventListener('visibilitychange', onVisibility);
      scene.traverse(object => { if (object instanceof T.SpotLight) object.shadow.dispose(); });
      disposeModel(scene); library?.forEach(disposeModel); environment?.dispose(); renderer?.dispose();
    };
  }, [attempt]);
  useEffect(() => { try { api.current?.replace(appearance, role, instrument, richClothing); } catch { setStatus('error'); } }, [appearance, role, instrument, richClothing]);
  return <div className="player-model-preview">
    <canvas ref={canvas} tabIndex={0} role="img" aria-label="Your animated 3D stage model. Drag to rotate, scroll to zoom, or use the buttons below." onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); api.current?.rotate(event.key === 'ArrowLeft' ? -.25 : .25); } if (event.key === '+' || event.key === '-') { event.preventDefault(); api.current?.zoom(event.key === '+' ? .9 : 1.1); } }} />
    <div className="player-model-preview__label" aria-hidden="true">ROCKMUNDO <span>BACKSTAGE / FITTING ROOM</span></div>
    {status !== 'ready' && <div className="player-model-preview__overlay" role={status === 'error' ? 'alert' : 'status'}><strong>{status === 'error' ? 'The model could not load' : 'Preparing your fitting room…'}</strong>{status === 'error' && <><p>Check your connection and try again.</p><button type="button" onClick={() => setAttempt(value => value + 1)}>Retry preview</button></>}</div>}
    <div className="player-model-preview__controls" aria-label="Model camera"><button type="button" onClick={() => api.current?.rotate(-Math.PI / 4)} aria-label="Rotate model left">↶</button><button type="button" onClick={() => api.current?.rotate(Math.PI / 4)} aria-label="Rotate model right">↷</button><button type="button" onClick={() => api.current?.zoom(.85)} aria-label="Zoom in">＋</button><button type="button" onClick={() => api.current?.zoom(1.15)} aria-label="Zoom out">−</button><button type="button" onClick={() => api.current?.focusHead()}>Face close-up</button><button type="button" onClick={() => api.current?.reset()}>Full body</button></div>
  </div>;
}
