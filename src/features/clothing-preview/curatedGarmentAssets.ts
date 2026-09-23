import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { demoAssetUrl } from '@/features/gig-demo-3d/assets';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ModelLibrary } from '@/features/player-model/model';
import type { PlayerAppearance } from '@/features/player-model/appearance';
import { curatedDonorSource } from './curatedDonorGarments';

export type CuratedAssetStatus = NonNullable<ClothingItem['curated_asset_status']>;

const LIVE_STATUSES = new Set<CuratedAssetStatus>(['validated', 'published']);

export function isCuratedClothing(item: ClothingItem) {
  return !!item.curated_asset_key && item.curated_asset_status !== 'legacy';
}

export function isCuratedClothingRenderable(item: ClothingItem) {
  return !!item.curated_asset_key && LIVE_STATUSES.has((item.curated_asset_status || 'legacy') as CuratedAssetStatus);
}

export function curatedGarmentFile(item: ClothingItem, frame: PlayerAppearance['body']['frame']) {
  if (curatedDonorSource(item)) return null;
  if (!item.curated_asset_key) return null;
  const safe = item.curated_asset_key.replace(/[^a-z0-9._-]/gi, '-');
  return `clothing/${frame}/${safe}.glb`;
}

export function requiredCuratedGarmentFiles(
  rows: Array<{ item: ClothingItem }>,
  frame: PlayerAppearance['body']['frame'],
) {
  return [...new Set(rows
    .filter(row => isCuratedClothingRenderable(row.item))
    .map(row => curatedGarmentFile(row.item, frame))
    .filter((value): value is string => !!value))];
}

export async function loadOptionalCuratedGarments(library: ModelLibrary, files: string[], manager?: T.LoadingManager) {
  const loader = new GLTFLoader(manager);
  await Promise.all([...new Set(files)].map(async file => {
    if (library.has(file)) return;
    try {
      const gltf = await loader.loadAsync(demoAssetUrl(file));
      library.set(file, gltf.scene);
    } catch (error) {
      // A bad cosmetic must never prevent the whole gig from loading.
      console.warn('[curated-clothing] optional asset unavailable', file, error);
    }
  }));
}

function targetBones(root: T.Object3D) {
  const bones = new Map<string, T.Bone>();
  root.traverse(node => {
    if (node instanceof T.Bone) bones.set(node.name, node);
  });
  return bones;
}

function cloneMaterial(material: T.Material) {
  return material.clone();
}

/**
 * Curated garments are authored against the Rockmundo avatar skeleton and stored
 * as standalone GLBs. At runtime we discard the garment's donor armature and
 * bind its skinned meshes to the already-visible avatar skeleton.
 */
export function buildCuratedGarment(
  library: ModelLibrary,
  avatarRoot: T.Object3D,
  item: ClothingItem,
  frame: PlayerAppearance['body']['frame'],
) {
  const file = curatedGarmentFile(item, frame);
  if (!file) throw new Error('Curated clothing asset key is missing.');
  const source = library.get(file);
  if (!source) throw new Error(`Curated clothing asset could not load: ${file}`);

  const bones = targetBones(avatarRoot);
  const group = new T.Group();
  group.name = `curated-garment-${item.curated_asset_key}`;

  source.updateMatrixWorld(true);
  source.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    const mesh = clone(node) as T.SkinnedMesh;
    mesh.geometry = node.geometry.clone();
    mesh.material = Array.isArray(node.material)
      ? node.material.map(cloneMaterial)
      : cloneMaterial(node.material);
    const bound = node.skeleton.bones.map(donor => {
      const target = bones.get(donor.name);
      if (!target) throw new Error(`Curated garment uses unknown avatar bone: ${donor.name}`);
      return target;
    });
    mesh.bind(
      new T.Skeleton(bound, node.skeleton.boneInverses.map(matrix => matrix.clone())),
      node.bindMatrix.clone(),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  });

  if (!group.children.length) throw new Error(`Curated clothing asset has no skinned meshes: ${file}`);
  return group;
}

export function disposeCuratedGarment(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material);
      Object.values(material).forEach(value => {
        if (value instanceof T.Texture) textures.add(value);
      });
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
  root.removeFromParent();
  root.clear();
}
