import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { STYLES, modelFile, type PlayerAppearance } from '@/features/player-model/appearance';
import { assemblePlayerModel, disposeModel, loadModelLibrary, type ModelLibrary } from '@/features/player-model/model';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ClothingPreviewVariant } from './clothingPreview';
import { buildProceduralGarment, disposeProceduralGarment } from './proceduralGarmentRenderer';
import { buildCuratedGarment, curatedGarmentFile, disposeCuratedGarment, isCuratedClothing, isCuratedClothingRenderable } from './curatedGarmentAssets';
import { curatedDonorSource } from './curatedDonorGarments';
import { avatarQualityProfile, recommendedAvatarPreviewQuality } from '@/features/player-model/avatarVisualQuality';

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
  const liveScene = useRef<{ scene: T.Scene; garment: T.Group | null; avatar: T.Object3D | null; library: ModelLibrary | null; ready: boolean } | null>(null);
  const latestPreview = useRef({ item, variant });
  latestPreview.current = { item, variant };
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
    const visualQuality = recommendedAvatarPreviewQuality();
    const qualityProfile = avatarQualityProfile(visualQuality);
    liveScene.current = { scene, garment: null, avatar: null, library: null, ready: false };
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
      key.shadow.mapSize.set(qualityProfile.shadowMapSize, qualityProfile.shadowMapSize);
      key.shadow.normalBias = .018;
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
        renderer!.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityProfile.previewPixelRatioCap));
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

      const garmentFile = isCuratedClothingRenderable(item) ? curatedGarmentFile(item, appearance.body.frame) : null;
      const modelFiles = (['masculine', 'feminine'] as const).flatMap(frameType => STYLES.map(style => modelFile(frameType, style)));
      if (garmentFile) modelFiles.push(garmentFile);
      void loadModelLibrary(modelFiles).then(loaded => {
        if (!alive) {
          loaded.forEach(disposeModel);
          return;
        }
        library = loaded;
        const currentPreview = latestPreview.current;
        const donor = curatedDonorSource(currentPreview.item);
        const previewClothing = donor ? [{ item: currentPreview.item, variant: currentPreview.variant }] as any : [];
        const base = assemblePlayerModel(library, appearance, [], previewClothing, visualQuality);
        scene.add(base);
        if (donor) {
          garment = null;
        } else if (isCuratedClothing(currentPreview.item)) {
          if (!isCuratedClothingRenderable(currentPreview.item)) {
            throw new Error('This curated skin is not validated for preview yet.');
          }
          garment = buildCuratedGarment(library, base, currentPreview.item, appearance.body.frame);
        } else {
          garment = buildProceduralGarment(currentPreview.item, currentPreview.variant);
          garment.scale.y *= appearance.body.height;
        }
        if (garment) scene.add(garment);
        if (liveScene.current) {
          liveScene.current.garment = garment;
          liveScene.current.avatar = base;
          liveScene.current.library = library;
          liveScene.current.ready = true;
        }
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
        if (isCuratedClothing(latestPreview.current.item)) disposeCuratedGarment(garment);
        else disposeProceduralGarment(garment);
      }
      disposeModel(scene);
      library?.forEach(disposeModel);
      environment?.dispose();
      renderer?.dispose();
      api.current = null;
      liveScene.current = null;
    };
  }, [appearance, attempt, item, variant]);

  useEffect(() => {
    const live = liveScene.current;
    if (!live?.ready) return;
    if (live.garment) {
      live.scene.remove(live.garment);
      if (isCuratedClothing(latestPreview.current.item)) disposeCuratedGarment(live.garment);
      else disposeProceduralGarment(live.garment);
    }
    if (curatedDonorSource(item)) {
      // Donor-backed curated skins are part of the avatar assembly itself. Rebuild
      // the scene on the next effect pass rather than layering a second garment.
      live.garment = null;
      return;
    }
    if (isCuratedClothing(item)) {
      if (!isCuratedClothingRenderable(item) || !live.avatar || !live.library) {
        live.garment = null;
        setStatus('error');
        return;
      }
      try {
        const next = buildCuratedGarment(live.library, live.avatar, item, appearance.body.frame);
        live.scene.add(next);
        live.garment = next;
        setStatus('ready');
      } catch {
        live.garment = null;
        setStatus('error');
      }
      return;
    }
    const next = buildProceduralGarment(item, variant);
    next.scale.y *= appearance.body.height;
    live.scene.add(next);
    live.garment = next;
    setStatus('ready');
  }, [item, variant, appearance.body.height]);

  return <div className="player-model-preview" style={{ position: "relative", width: "100%", height: "100%", minHeight: 520 }}>
    <canvas
      ref={canvas}
      style={{ display: "block", width: "100%", height: "100%", minHeight: 520 }}
      tabIndex={0}
      role="img"
      aria-label={`${item.name} on your avatar. Drag to rotate 360 degrees and scroll to zoom.`}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') api.current?.rotate(event.key === 'ArrowLeft' ? -.25 : .25);
      }}
    />
    <div className="player-model-preview__label" aria-hidden="true">ROCKMUNDO <span>RICH GARMENT FITTING ROOM</span></div>
    {status !== 'ready' && <div className="player-model-preview__overlay">
      <strong>{status === 'error' ? (isCuratedClothing(item) && !isCuratedClothingRenderable(item) ? 'Curated skin is awaiting validation' : 'Garment preview could not load') : 'Loading garment preview…'}</strong>
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
