import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STYLES, modelFile, type PlayerAppearance } from '@/features/player-model/appearance';
import { assemblePlayerModel, disposeModel, loadModelLibrary, type ModelLibrary } from '@/features/player-model/model';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ClothingPreviewVariant } from './clothingPreview';
import { buildProceduralGarment, disposeProceduralGarment } from './proceduralGarmentRenderer';

interface PreviewApi {
  rotate: (angle: number) => void;
  zoom: (factor: number) => void;
  reset: () => void;
}

export type RichClothingPreviewStatus = 'loading' | 'ready' | 'error';

interface Props {
  appearance: PlayerAppearance;
  item: ClothingItem;
  variant?: ClothingPreviewVariant;
  onStatusChange?: (status: RichClothingPreviewStatus) => void;
}

export function RichClothingPreview({ appearance, item, variant, onStatusChange }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const api = useRef<PreviewApi | null>(null);
  const [status, setStatus] = useState<RichClothingPreviewStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => onStatusChange?.(status), [onStatusChange, status]);

  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    let raf = 0;
    let garment: T.Group | null = null;
    let library: ModelLibrary | null = null;
    let renderer: T.WebGLRenderer | undefined;
    let environment: T.WebGLRenderTarget | undefined;
    let controls: OrbitControls | undefined;
    let observer: ResizeObserver | undefined;
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(35, 1, .05, 30);
    const element = canvas.current;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      if (alive) setStatus('error');
    };

    setStatus('loading');
    try {
      renderer = new T.WebGLRenderer({ canvas: element, antialias: true, powerPreference: 'high-performance' });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;
      renderer.shadowMap.enabled = true;
      element.addEventListener('webglcontextlost', onContextLost);

      scene.background = new T.Color('#101823');
      const pmrem = new T.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();

      scene.add(new T.HemisphereLight('#cddaf0', '#202938', 1.4));
      const key = new T.SpotLight('#ffe4c7', 38, 14, .72, .8, 1.4);
      key.position.set(-2.4, 4.3, 4);
      key.target.position.set(0, 1, 0);
      key.castShadow = true;
      scene.add(key, key.target);
      const rim = new T.DirectionalLight('#66d4ee', 2);
      rim.position.set(2.5, 3, -2);
      scene.add(rim);

      const floor = new T.Mesh(new T.CircleGeometry(1.25, 64), new T.MeshStandardMaterial({ color: '#293545', roughness: .65, metalness: .22 }));
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -.035;
      floor.receiveShadow = true;
      scene.add(floor);

      camera.position.set(2.05, 1.55, 4.65);
      controls = new OrbitControls(camera, element);
      controls.target.set(0, .95, 0);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 2.1;
      controls.maxDistance = 6.4;
      controls.update();
      controls.saveState();

      observer = new ResizeObserver(() => {
        const rect = element.getBoundingClientRect();
        renderer!.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer!.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
        camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
        camera.updateProjectionMatrix();
      });
      observer.observe(element);

      const frame = () => {
        if (!alive) return;
        controls?.update();
        renderer?.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      void loadModelLibrary((['masculine', 'feminine'] as const).flatMap(frameType => STYLES.map(style => modelFile(frameType, style)))).then(loaded => {
        if (!alive) {
          loaded.forEach(disposeModel);
          return;
        }
        library = loaded;
        const base = assemblePlayerModel(library, appearance);
        scene.add(base);
        garment = buildProceduralGarment(item, variant);
        garment.scale.y *= appearance.body.height;
        scene.add(garment);
        api.current = {
          rotate: angle => {
            camera.position.sub(controls!.target).applyAxisAngle(new T.Vector3(0, 1, 0), angle).add(controls!.target);
            controls!.update();
          },
          zoom: factor => {
            const offset = camera.position.clone().sub(controls!.target);
            offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls!.minDistance, controls!.maxDistance));
            camera.position.copy(controls!.target).add(offset);
            controls!.update();
          },
          reset: () => controls!.reset(),
        };
        setStatus('ready');
      }).catch(() => alive && setStatus('error'));
    } catch {
      setStatus('error');
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      controls?.dispose();
      element.removeEventListener('webglcontextlost', onContextLost);
      if (garment) {
        scene.remove(garment);
        disposeProceduralGarment(garment);
      }
      disposeModel(scene);
      library?.forEach(disposeModel);
      environment?.dispose();
      renderer?.dispose();
      api.current = null;
    };
  }, [appearance, item, variant, attempt]);

  return <div className="player-model-preview">
    <canvas
      ref={canvas}
      tabIndex={0}
      role="img"
      aria-label={`${item.name} on your avatar. Drag to rotate 360 degrees and scroll to zoom.`}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') api.current?.rotate(event.key === 'ArrowLeft' ? -.25 : .25);
      }}
    />
    <div className="player-model-preview__label" aria-hidden="true">ROCKMUNDO <span>RICH GARMENT FITTING ROOM</span></div>
    {status !== 'ready' && <div className="player-model-preview__overlay">
      <strong>{status === 'error' ? 'Rich garment preview could not load' : 'Building garment preview…'}</strong>
      {status === 'error' && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry</button>}
    </div>}
    <div className="player-model-preview__controls" aria-label="Model camera">
      <button type="button" onClick={() => api.current?.rotate(-Math.PI / 4)}>↶</button>
      <button type="button" onClick={() => api.current?.rotate(Math.PI / 4)}>↷</button>
      <button type="button" onClick={() => api.current?.zoom(.85)}>＋</button>
      <button type="button" onClick={() => api.current?.zoom(1.15)}>−</button>
      <button type="button" onClick={() => api.current?.reset()}>Full body</button>
    </div>
  </div>;
}
