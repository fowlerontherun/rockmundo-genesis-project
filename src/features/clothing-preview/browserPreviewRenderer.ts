import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { ClothingItem } from '@/hooks/useSkinStore';
import { clothingPreviewVariants, type ClothingPreviewVariant } from './clothingPreview';
import { buildProceduralGarment, disposeProceduralGarment } from './proceduralGarmentRenderer';
import { CLOTHING_PREVIEW_RENDERER_VERSION, CLOTHING_TURNTABLE_VIEWS, type ClothingPreviewViewKey } from './previewManifest';
import { STYLES, defaultAppearance, modelFile } from '@/features/player-model/appearance';
import { assemblePlayerModel, disposeModel, loadModelLibrary, type ModelLibrary } from '@/features/player-model/model';
import { curatedDonorSource } from './curatedDonorGarments';
import { buildCuratedGarment, curatedGarmentFile, disposeCuratedGarment, isCuratedClothing, isCuratedClothingRenderable } from './curatedGarmentAssets';

export interface RenderedPreviewFrame {
  key: ClothingPreviewViewKey;
  yaw: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface BrowserPreviewRenderOptions {
  width?: number;
  height?: number;
  quality?: number;
  views?: readonly { key: ClothingPreviewViewKey; yaw: number }[];
  variant?: ClothingPreviewVariant;
}

export const CLOTHING_PREVIEW_BUCKET = 'clothing-previews';

export function clothingPreviewStoragePath(itemId: string, jobId: string, view: ClothingPreviewViewKey) {
  return `${itemId}/${CLOTHING_PREVIEW_RENDERER_VERSION}/${jobId}/${view}.webp`;
}

function addMannequin(scene: T.Scene) {
  const group = new T.Group();
  group.name = 'clothing-preview-mannequin';
  const material = new T.MeshStandardMaterial({ color: '#777f8c', roughness: .9, metalness: 0 });
  const joint = new T.MeshStandardMaterial({ color: '#666e7b', roughness: .95, metalness: 0 });
  const add = (mesh: T.Mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); };

  const torso = new T.Mesh(new T.CapsuleGeometry(.35, .72, 8, 20), material);
  torso.position.y = 1.15;
  torso.scale.z = .72;
  add(torso);

  const head = new T.Mesh(new T.SphereGeometry(.2, 24, 18), material);
  head.position.y = 1.78;
  head.scale.set(.9, 1.08, .92);
  add(head);

  const neck = new T.Mesh(new T.CylinderGeometry(.09, .1, .16, 16), joint);
  neck.position.y = 1.58;
  add(neck);

  for (const side of [-1, 1]) {
    const arm = new T.Mesh(new T.CapsuleGeometry(.085, .62, 7, 14), material);
    arm.position.set(side * .47, 1.13, 0);
    arm.rotation.z = side * -.08;
    add(arm);
    const leg = new T.Mesh(new T.CapsuleGeometry(.11, .78, 7, 14), material);
    leg.position.set(side * .16, .48, 0);
    add(leg);
  }

  const pelvis = new T.Mesh(new T.CapsuleGeometry(.27, .18, 6, 14), joint);
  pelvis.position.y = .75;
  pelvis.rotation.z = Math.PI / 2;
  add(pelvis);

  scene.add(group);
  return group;
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error('This browser could not encode the clothing preview as WebP.'));
        return;
      }
      if (blob.type !== 'image/webp') {
        reject(new Error('This browser does not support WebP clothing preview generation. Use a current Chrome, Edge, Firefox or Safari browser.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

export async function renderClothingTurntable(item: ClothingItem, options: BrowserPreviewRenderOptions = {}): Promise<RenderedPreviewFrame[]> {
  if (typeof document === 'undefined') throw new Error('Clothing preview rendering requires a browser environment.');
  const curated = isCuratedClothing(item);
  const width = Math.max(320, Math.min(1600, Math.round(options.width || (curated ? 1440 : 640))));
  const height = Math.max(400, Math.min(2000, Math.round(options.height || (curated ? 1800 : 800))));
  const quality = Math.max(.55, Math.min(.98, options.quality ?? (curated ? .96 : .86)));
  const views = options.views?.length ? options.views : CLOTHING_TURNTABLE_VIEWS;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.24;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.background = new T.Color('#101823');
  const camera = new T.PerspectiveCamera(32, width / height, .05, 20);
  const target = new T.Vector3(0, .98, 0);

  scene.add(new T.HemisphereLight('#d7e2f3', '#1e2633', 1.65));
  const key = new T.DirectionalLight('#ffe5cb', 3.7);
  key.position.set(-2.4, 4.2, 3.8);
  key.castShadow = true;
  key.shadow.mapSize.set(curated ? 4096 : 1024, curated ? 4096 : 1024);
  key.shadow.normalBias = .02;
  scene.add(key);
  const fill = new T.DirectionalLight('#76d9ef', 1.45);
  fill.position.set(2.8, 2.6, -2.5);
  scene.add(fill);
  const warm = new T.DirectionalLight('#d897c6', .7);
  warm.position.set(-2.4, 1.5, -2.4);
  scene.add(warm);

  const floor = new T.Mesh(new T.CircleGeometry(1.25, 64), new T.MeshStandardMaterial({ color: '#293545', roughness: .7, metalness: .18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.04;
  floor.receiveShadow = true;
  scene.add(floor);

  let garment: T.Group | null = null;
  let curatedAvatar: T.Object3D | null = null;
  let library: ModelLibrary | null = null;

  const result: RenderedPreviewFrame[] = [];
  try {
    if (isCuratedClothing(item)) {
      if (!isCuratedClothingRenderable(item)) throw new Error('Curated clothing must be validated before preview generation.');
      const frame = item.supported_frames?.includes('masculine') ? 'masculine' : 'feminine';
      const appearance = defaultAppearance(item.id);
      appearance.body.frame = frame;
      appearance.body.height = 1;
      appearance.body.build = 1;
      const variant = options.variant || clothingPreviewVariants(item)[0];
      const garmentFile = curatedGarmentFile(item, frame);
      const files = STYLES.map(style => modelFile(frame, style));
      if (garmentFile) files.push(garmentFile);
      library = await loadModelLibrary(files);
      const donor = curatedDonorSource(item);
      curatedAvatar = assemblePlayerModel(library, appearance, [], donor ? [{ item, variant }] : [], 'cinematic');
      curatedAvatar.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      scene.add(curatedAvatar);
      if (!donor) {
        garment = buildCuratedGarment(library, curatedAvatar, item, frame);
        scene.add(garment);
      }
    } else {
      addMannequin(scene);
      garment = buildProceduralGarment(item, options.variant);
      scene.add(garment);
    }

    for (const view of views) {
      const radians = T.MathUtils.degToRad(view.yaw);
      const radius = 4.15;
      camera.position.set(Math.sin(radians) * radius, 1.18, Math.cos(radians) * radius);
      camera.lookAt(target);
      renderer.render(scene, camera);
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      renderer.render(scene, camera);
      const blob = await canvasToWebp(canvas, quality);
      result.push({ key: view.key, yaw: view.yaw, blob, width, height });
    }
    return result;
  } finally {
    if (garment) {
      scene.remove(garment);
      if (isCuratedClothing(item)) disposeCuratedGarment(garment);
      else disposeProceduralGarment(garment);
    }
    if (curatedAvatar) {
      scene.remove(curatedAvatar);
      disposeModel(curatedAvatar);
    }
    library?.forEach(disposeModel);
    scene.traverse(object => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    environment.dispose();
    renderer.dispose();
  }
}
