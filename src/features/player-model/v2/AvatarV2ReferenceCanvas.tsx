import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { disposeModel } from '../model';
import type { PlayerAppearance } from '../appearance';
import { isAvatarV2PreviewIrisMaterial, isAvatarV2PreviewSkinMaterial } from './avatarV2PreviewMaterials';

/**
 * Read-only viewer for published Blender SOURCE/LOOKDEV previews.
 *
 * This deliberately does not use the production Avatar V2 loader, rig,
 * customization, saved appearance or gig-player assembly. The source mesh has
 * no approved skin weights/morphs, so this is only an inspectable A-pose.
 * It mounts only after the player explicitly chooses to load 3D.
 */
export function AvatarV2ReferenceCanvas({
  url,
  focus,
  experimentalRig = false,
  appearance,
}: {
  url: string;
  appearance?: PlayerAppearance;
  focus: 'full' | 'face';
  experimentalRig?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewModel = useRef<T.Object3D | null>(null);
  const referenceScale = useRef(1);
  const originalSkinMaterials = useRef<Array<{ material: T.MeshStandardMaterial; color: T.Color }>>([]);
  const irisMaterials = useRef<T.MeshStandardMaterial[]>([]);
  const redraw = useRef<(() => void) | null>(null);
  const skinTone = useRef(appearance?.body.skin);
  skinTone.current = appearance?.body.skin;
  const eyeColor = useRef(appearance?.head.eyeColor);
  eyeColor.current = appearance?.head.eyeColor;
  const proportions = useRef({ height: appearance?.body.height ?? 1, build: appearance?.body.build ?? 1 });
  proportions.current = { height: appearance?.body.height ?? 1, build: appearance?.body.build ?? 1 };
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [skinMaterialCount, setSkinMaterialCount] = useState<number | null>(null);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    let active = true;
    let queuedFrame = 0;
    let renderer: T.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let candidate: T.Object3D | null = null;

    const scene = new T.Scene();
    scene.background = new T.Color('#101823');
    const camera = new T.PerspectiveCamera(focus === 'face' ? 28 : 34, 1, .025, 30);
    camera.position.set(focus === 'face' ? .27 : 1.4, focus === 'face' ? 1.60 : 1.52, focus === 'face' ? .88 : 3.65);

    const floor = new T.Mesh(
      new T.CircleGeometry(1.1, 48),
      new T.MeshStandardMaterial({ color: '#253143', roughness: .7 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    scene.add(new T.HemisphereLight('#e2ebff', '#283346', 2.6));
    const key = new T.DirectionalLight('#fff0df', 3.5);
    key.position.set(-1.5, 3, 2.5);
    scene.add(key);
    const rim = new T.DirectionalLight('#b3defb', 2);
    rim.position.set(2, 2.8, -1.8);
    scene.add(rim);

    const draw = () => {
      queuedFrame = 0;
      if (active) renderer?.render(scene, camera);
    };
    const requestDraw = () => {
      if (active && !queuedFrame) queuedFrame = requestAnimationFrame(draw);
    };
    redraw.current = requestDraw;
    setStatus('loading');
    setError('');
    setSkinMaterialCount(null);

    try {
      renderer = new T.WebGLRenderer({
        canvas: element, antialias: true, powerPreference: 'low-power',
      });
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      controls = new OrbitControls(camera, element);
      controls.enablePan = false;
      controls.enableDamping = false; // Static source proof: render only on user interaction.
      controls.minDistance = focus === 'face' ? .35 : .9;
      controls.maxDistance = focus === 'face' ? 2.2 : 7;
      controls.target.set(0, focus === 'face' ? 1.60 : .9, 0);
      controls.addEventListener('change', requestDraw);

      const resize = () => {
        if (!renderer || !active) return;
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return;
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
        requestDraw();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(element);
      resize();

      void new GLTFLoader().loadAsync(url).then(gltf => {
        if (!active) {
          disposeModel(gltf.scene);
          return;
        }
        const source = gltf.scene;
        source.updateMatrixWorld(true);
        const bounds = new T.Box3().setFromObject(source);
        const size = bounds.getSize(new T.Vector3());
        if (!Number.isFinite(size.y) || size.y < .3) {
          disposeModel(source);
          throw new Error('This reference model has no measurable body height.');
        }
        // Display at human scale and ground the unchanged source A-pose.
        referenceScale.current = 1.78 / size.y;
        source.scale.setScalar(referenceScale.current);
        source.updateMatrixWorld(true);
        const scaled = new T.Box3().setFromObject(source);
        source.position.y -= scaled.min.y;
        // Creator body proportions are a reversible preview transform only.
        // Unfitted source meshes cannot yet support safe garment, hair or
        // accessory attachment, and these edits are never saved as V2 assets.
        source.scale.x *= proportions.current.build;
        source.scale.z *= proportions.current.build;
        source.scale.y *= proportions.current.height;
        source.updateMatrixWorld(true);
        source.position.y -= new T.Box3().setFromObject(source).min.y;
        // Only recolour materials explicitly identified as skin by the
        // Blender export. Do not tint eyes, clothes or unidentified meshes.
        originalSkinMaterials.current = [];
        irisMaterials.current = [];
        const clones = new Map<T.MeshStandardMaterial, T.MeshStandardMaterial>();
        source.traverse(object => {
          if (!(object instanceof T.Mesh)) return;
          const cloneSkin = (material: T.Material): T.Material => {
            if (!(material instanceof T.MeshStandardMaterial) ||
                (!isAvatarV2PreviewSkinMaterial(material.name) && !isAvatarV2PreviewIrisMaterial(material.name))) return material;
            let clone = clones.get(material);
            if (!clone) {
              clone = material.clone();
              clones.set(material, clone);
              if (isAvatarV2PreviewSkinMaterial(material.name)) {
                originalSkinMaterials.current.push({ material: clone, color: clone.color.clone() });
              } else irisMaterials.current.push(clone);
            }
            return clone;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(cloneSkin)
            : cloneSkin(object.material);
        });
        setSkinMaterialCount(originalSkinMaterials.current.length);
        if (skinTone.current) {
          for (const entry of originalSkinMaterials.current) entry.material.color.set(skinTone.current);
        }
        if (eyeColor.current) for (const iris of irisMaterials.current) iris.color.set(eyeColor.current);
        previewModel.current = source;
        candidate = source;
        scene.add(source);
        setStatus('ready');
        requestDraw();
      }).catch(cause => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'The 3D preview could not load.');
        setStatus('error');
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '3D is unavailable on this device.');
      setStatus('error');
    }

    return () => {
      active = false;
      previewModel.current = null;
      originalSkinMaterials.current = [];
      irisMaterials.current = [];
      redraw.current = null;
      cancelAnimationFrame(queuedFrame);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (candidate) {
        candidate.removeFromParent();
        disposeModel(candidate);
      }
      floor.geometry.dispose();
      (floor.material as T.Material).dispose();
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, [url, focus]);

  // Creator sliders should update the loaded mesh without fetching the GLB,
  // resetting the orbit camera or destroying the WebGL context on every drag.
  useEffect(() => {
    const model = previewModel.current;
    if (!model) return;
    const baseline = referenceScale.current;
    model.scale.set(baseline * proportions.current.build, baseline * proportions.current.height, baseline * proportions.current.build);
    // Re-ground from the model's current bounding box after every edit, even
    // when the original GLB has a non-zero origin or the height is reduced.
    model.updateMatrixWorld(true);
    model.position.y -= new T.Box3().setFromObject(model).min.y;
    redraw.current?.();
  }, [appearance?.body.build, appearance?.body.height]);

  useEffect(() => {
    for (const entry of originalSkinMaterials.current) {
      entry.material.color.copy(appearance?.body.skin ? new T.Color(appearance.body.skin) : entry.color);
    }
    redraw.current?.();
  }, [appearance?.body.skin]);

  useEffect(() => {
    if (!appearance?.head.eyeColor) return;
    for (const iris of irisMaterials.current) iris.color.set(appearance.head.eyeColor);
    redraw.current?.();
  }, [appearance?.head.eyeColor]);

  return (
    <div className="avatar-v2-public__canvas-wrap">
      <canvas
        ref={canvasRef}
        aria-label={experimentalRig
          ? 'Rotate and zoom the genuine, partially skinned V2 Blender head-motion experiment'
          : 'Rotate and zoom the genuine, unrigged Avatar V2 Blender preview'}
        className="avatar-v2-public__canvas"
      />
      {status === 'loading' && (
        <p className="avatar-v2-public__canvas-overlay" role="status">Loading genuine Blender reference model…</p>
      )}
      {status === 'error' && (
        <p className="avatar-v2-public__canvas-overlay" role="alert">
          3D preview unavailable: {error} The image previews are still available.
        </p>
      )}
      {status === 'ready' && skinMaterialCount === 0 && (
        <p className="avatar-v2-public__skin-warning" role="status">Skin tone is not available for this Blender export: no separately named skin material was found.</p>
      )}
      {status === 'ready' && (
        <p className="avatar-v2-public__canvas-caption">
          Drag to rotate · scroll or pinch to zoom · {experimentalRig ? 'Experimental head rig only · unapproved weights' : 'A-pose only'}
        </p>
      )}
    </div>
  );
}
