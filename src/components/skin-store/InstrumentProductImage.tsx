import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { Guitar } from 'lucide-react';
import { buildInstrument } from '@/features/gig-demo-3d/instruments';
import { disposeModel } from '@/features/player-model/model';
import type { InstrumentSkinItem } from '@/features/instrument-skins/instrumentSkin';

/** A still product photograph rendered with the same instrument as the stage. */
export function InstrumentProductImage({ item }: { item: InstrumentSkinItem }) {
  const host = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string>();
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    setImage(undefined);
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      let renderer: T.WebGLRenderer | undefined;
      let root: T.Group | undefined;
      try {
        renderer = new T.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        renderer.setSize(640, 480);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = T.SRGBColorSpace;
        const scene = new T.Scene();
        const rig = buildInstrument(item.target_instrument, item.body_color, {
          itemId: item.id, instrumentId: item.target_instrument,
          bodyColor: item.body_color, secondaryColor: item.secondary_color,
          pickguardColor: item.pickguard_color, hardwareColor: item.hardware_color,
          designKey: item.design_key,
        });
        root = rig.root;
        scene.add(root);
        scene.add(new T.HemisphereLight(0xffffff, 0x646464, 2.5));
        const light = new T.DirectionalLight(0xffffff, 3); light.position.set(-2, 4, 5); scene.add(light);
        root.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(root);
        const center = bounds.getCenter(new T.Vector3());
        const size = bounds.getSize(new T.Vector3());
        const half = Math.max(size.y, size.x / (4 / 3)) * .63;
        const camera = new T.OrthographicCamera(-half * 4 / 3, half * 4 / 3, half, -half, .01, 100);
        camera.position.copy(center).add(new T.Vector3(.12, .08, 5)); camera.lookAt(center);
        renderer.render(scene, camera);
        setImage(renderer.domElement.toDataURL('image/webp'));
      } catch { /* The standard icon remains available if WebGL is unavailable. */ }
      finally { if (root) disposeModel(root); renderer?.dispose(); }
    }, { rootMargin: '150px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [item]);
  return <div ref={host} className="absolute inset-0 flex items-center justify-center">
    {image ? <img src={image} alt={`${item.name} stage instrument`} className="h-full w-full object-contain" /> : <Guitar className="h-16 w-16 text-muted-foreground" />}
  </div>;
}