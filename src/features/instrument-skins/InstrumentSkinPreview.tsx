import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildInstrument } from '@/features/gig-demo-3d/instruments';
import type { InstrumentSkinItem, ResolvedInstrumentSkinVisual } from './instrumentSkin';

function disposeObject(root: T.Object3D) {
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return;
    object.geometry?.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const standard = material as T.MeshStandardMaterial;
      standard.map?.dispose();
      material.dispose();
    }
  });
}

export function InstrumentSkinPreview({ item, visual }: { item: InstrumentSkinItem; visual: ResolvedInstrumentSkinVisual }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!canvas.current) return;
    let alive = true;
    let raf = 0;
    const element = canvas.current;
    const scene = new T.Scene();
    scene.background = new T.Color('#101823');
    const camera = new T.PerspectiveCamera(34, 1, .05, 30);
    camera.position.set(1.8, 1.25, 3.5);
    let renderer: T.WebGLRenderer | null = null;
    let environment: T.WebGLRenderTarget | null = null;
    let controls: OrbitControls | null = null;
    let observer: ResizeObserver | null = null;
    let display: T.Group | null = null;

    setStatus('loading');
    try {
      renderer = new T.WebGLRenderer({ canvas: element, antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.25;

      const pmrem = new T.PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      environment = pmrem.fromScene(room, .04);
      scene.environment = environment.texture;
      room.dispose();
      pmrem.dispose();

      scene.add(new T.HemisphereLight('#d8e5ff', '#202a38', 2.1));
      const key = new T.DirectionalLight('#fff0df', 4.2);
      key.position.set(-2, 4, 3);
      scene.add(key);
      const rim = new T.DirectionalLight('#70d9ff', 2.4);
      rim.position.set(3, 2, -2);
      scene.add(rim);

      controls = new OrbitControls(camera, element);
      controls.enablePan = false;
      controls.enableDamping = true;
      controls.minDistance = 1.6;
      controls.maxDistance = 6;
      controls.target.set(0, 0, 0);

      const rig = buildInstrument(item.target_instrument, visual.bodyColor, visual);
      display = new T.Group();
      display.name = 'instrument-skin-preview';
      display.add(rig.root);
      scene.add(display);
      const bounds = new T.Box3().setFromObject(display);
      display.position.sub(bounds.getCenter(new T.Vector3()));
      display.rotation.set(.05, -.12, .15);

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
      setStatus('ready');
    } catch {
      setStatus('error');
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      controls?.dispose();
      if (display) disposeObject(display);
      environment?.dispose();
      renderer?.dispose();
    };
  }, [item.id, item.target_instrument, visual.designKey, visual.bodyColor, visual.secondaryColor, visual.pickguardColor, visual.hardwareColor]);

  return <div className="relative min-h-[420px] h-full">
    <canvas ref={canvas} className="block h-[420px] w-full" aria-label={`3D preview of ${item.name}`} />
    {status !== 'ready' && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">{status === 'error' ? '3D instrument preview unavailable' : 'Preparing instrument preview…'}</div>}
  </div>;
}
