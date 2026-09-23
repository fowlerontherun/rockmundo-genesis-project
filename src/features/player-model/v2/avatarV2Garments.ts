import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ClothingItem } from '@/hooks/useSkinStore';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import { disposeModel, type ModelLibrary } from '../model';
import type { AvatarV2Frame, AvatarV2Lod } from './avatarV2Contract';
import { avatarV2RuntimeBoneName, cleanAvatarV2Name } from './avatarV2Contract';
import { AVATAR_V2_ROLLOUT } from './avatarV2Registry';

export type AvatarV2GarmentStatus = 'planned' | 'asset_ready' | 'validated' | 'blocked';
export type AvatarV2BodyRegion =
  | 'torso'
  | 'upper-arms'
  | 'lower-arms'
  | 'hands'
  | 'hips'
  | 'upper-legs'
  | 'lower-legs'
  | 'feet';

export interface AvatarV2GarmentFrameAssets {
  lod0?: string;
  lod1?: string;
  lod2?: string;
  lod3?: string;
}

export interface AvatarV2GarmentConfig {
  version: 1;
  status: AvatarV2GarmentStatus;
  frames: Partial<Record<AvatarV2Frame, AvatarV2GarmentFrameAssets>>;
  occludeBodyRegions: AvatarV2BodyRegion[];
  colourMode: 'authored' | 'zones';
  materialZones: {
    main: string[];
    trim: string[];
  };
}

const BODY_REGIONS = new Set<AvatarV2BodyRegion>([
  'torso','upper-arms','lower-arms','hands','hips','upper-legs','lower-legs','feet',
]);
const STATUSES = new Set<AvatarV2GarmentStatus>(['planned','asset_ready','validated','blocked']);
const clean = cleanAvatarV2Name;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function safeAssetPath(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const file = value.replace(/^\/+/, '');
  if (!/^avatar-v2\/clothing\/[a-z0-9._/-]+\.glb$/i.test(file)) return undefined;
  if (file.includes('..')) return undefined;
  return file;
}

function frameAssets(value: unknown): AvatarV2GarmentFrameAssets {
  const source = record(value);
  return {
    ...(safeAssetPath(source.lod0) ? { lod0: safeAssetPath(source.lod0) } : {}),
    ...(safeAssetPath(source.lod1) ? { lod1: safeAssetPath(source.lod1) } : {}),
    ...(safeAssetPath(source.lod2) ? { lod2: safeAssetPath(source.lod2) } : {}),
    ...(safeAssetPath(source.lod3) ? { lod3: safeAssetPath(source.lod3) } : {}),
  };
}

export function avatarV2GarmentConfig(item: ClothingItem): AvatarV2GarmentConfig | null {
  const garment = record(item.garment_config);
  const source = record(garment.avatarV2);
  if (!Object.keys(source).length) return null;

  const status = String(source.status || 'planned') as AvatarV2GarmentStatus;
  if (!STATUSES.has(status)) return null;

  const frames = record(source.frames);
  const regions = stringList(source.occludeBodyRegions)
    .filter((region): region is AvatarV2BodyRegion => BODY_REGIONS.has(region as AvatarV2BodyRegion));
  const zones = record(source.materialZones);
  const colourMode = source.colourMode === 'zones' ? 'zones' : 'authored';

  return {
    version: source.version === 1 ? 1 : 1,
    status,
    frames: {
      masculine: frameAssets(frames.masculine),
      feminine: frameAssets(frames.feminine),
    },
    occludeBodyRegions: [...new Set(regions)],
    colourMode,
    materialZones: {
      main: stringList(zones.main),
      trim: stringList(zones.trim),
    },
  };
}

export function avatarV2GarmentFile(
  item: ClothingItem,
  frame: AvatarV2Frame,
  lod: AvatarV2Lod,
) {
  const config = avatarV2GarmentConfig(item);
  if (!config || config.status !== 'validated') return null;
  const assets = config.frames[frame];
  return assets?.[`lod${lod}` as keyof AvatarV2GarmentFrameAssets] ?? null;
}

export function requiredAvatarV2GarmentFiles(
  clothing: ResolvedEquippedClothing[],
  frame: AvatarV2Frame,
  lod: AvatarV2Lod,
) {
  if (!AVATAR_V2_ROLLOUT.enabled) return [];
  return [...new Set(clothing
    .map(row => avatarV2GarmentFile(row.item, frame, lod))
    .filter((file): file is string => !!file))];
}

export function avatarV2ClothingCompatibilityReason(
  clothing: ResolvedEquippedClothing[],
  frame: AvatarV2Frame,
  lod: AvatarV2Lod,
) {
  for (const row of clothing) {
    const slot = richGarmentSlot(row.item);
    if (!slot) return `Avatar V2 does not support clothing slot for ${row.item.name}.`;
    const config = avatarV2GarmentConfig(row.item);
    if (!config) return `${row.item.name} has no Avatar V2 garment mapping.`;
    if (config.status !== 'validated') return `${row.item.name} Avatar V2 garment is ${config.status}.`;
    if (!avatarV2GarmentFile(row.item, frame, lod)) {
      return `${row.item.name} has no validated Avatar V2 ${frame} LOD${lod} asset.`;
    }
    if (!config.occludeBodyRegions.length) {
      return `${row.item.name} has no Avatar V2 body occlusion regions.`;
    }
    if (config.colourMode === 'zones' && !config.materialZones.main.length) {
      return `${row.item.name} uses V2 colour zones without a main material zone.`;
    }
  }
  return null;
}

function targetBones(root: T.Object3D) {
  const exact = new Map<string, T.Bone>();
  const cleaned = new Map<string, T.Bone>();
  root.traverse(node => {
    if (!(node instanceof T.Bone)) return;
    exact.set(node.name, node);
    cleaned.set(clean(node.name), node);
  });
  return { exact, cleaned };
}

function bodyRegion(node: T.Object3D): AvatarV2BodyRegion | null {
  const explicit = String(node.userData?.rockmundoBodyRegion || '').toLowerCase();
  if (BODY_REGIONS.has(explicit as AvatarV2BodyRegion)) return explicit as AvatarV2BodyRegion;
  const name = node.name.toLowerCase().replace(/_/g, '-');
  const match = [...BODY_REGIONS].find(region =>
    name.includes(`body-${region}`) || name.includes(`body${region.replace(/-/g, '')}`)
  );
  return match ?? null;
}

function availableBodyRegions(root: T.Object3D) {
  const found = new Set<AvatarV2BodyRegion>();
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const region = bodyRegion(node);
    if (region) found.add(region);
  });
  return found;
}

function applyBodyOcclusion(root: T.Object3D, regions: AvatarV2BodyRegion[]) {
  const wanted = new Set(regions);
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const region = bodyRegion(node);
    if (!region || !wanted.has(region)) return;
    node.visible = false;
    node.userData.rockmundoV2OccludedByGarment = true;
  });
}

function ownMaterial(source: T.Material) {
  const material = source.clone();
  for (const key of ['map','normalMap','roughnessMap','bumpMap','metalnessMap','alphaMap','aoMap','emissiveMap'] as const) {
    const value = (material as T.MeshStandardMaterial)[key];
    if (value instanceof T.Texture) (material as T.MeshStandardMaterial)[key] = value.clone();
  }
  return material;
}

function applyVariant(
  mesh: T.SkinnedMesh,
  row: ResolvedEquippedClothing,
  config: AvatarV2GarmentConfig,
) {
  if (config.colourMode !== 'zones' || !row.variant) return;
  const main = new Set(config.materialZones.main.map(clean));
  const trim = new Set(config.materialZones.trim.map(clean));
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

  materials.forEach(material => {
    if (!(material instanceof T.MeshStandardMaterial)) return;
    const name = clean(material.name);
    if (main.has(name) && row.variant?.color) material.color.set(row.variant.color);
    if (trim.has(name) && row.variant?.secondaryColor) material.color.set(row.variant.secondaryColor);
    material.needsUpdate = true;
  });
}

function garmentMeshCount(root: T.Object3D) {
  let skinned = 0;
  let unskinned = 0;
  root.traverse(node => {
    if (node instanceof T.SkinnedMesh) skinned += 1;
    else if (node instanceof T.Mesh) unskinned += 1;
  });
  return { skinned, unskinned };
}

export interface AvatarV2GarmentBuildResult {
  group: T.Group;
  hiddenBodyRegions: AvatarV2BodyRegion[];
}

/**
 * Rebinds authored V2 garment meshes to the already-visible V2 skeleton.
 * Every visible garment mesh must be skinned; rigid zips/studs should simply be
 * weighted 100% to the appropriate bone so no detail can float in animation.
 */
export function buildAvatarV2Garments(
  library: ModelLibrary,
  avatarRoot: T.Object3D,
  clothing: ResolvedEquippedClothing[],
  frame: AvatarV2Frame,
  lod: AvatarV2Lod,
): AvatarV2GarmentBuildResult {
  const compatibility = avatarV2ClothingCompatibilityReason(clothing, frame, lod);
  if (compatibility) throw new Error(compatibility);

  const target = targetBones(avatarRoot);
  const group = new T.Group();
  group.name = 'rockmundo-avatar-v2-garments';
  const hidden = new Set<AvatarV2BodyRegion>();
  const available = availableBodyRegions(avatarRoot);

  for (const row of clothing) {
    const config = avatarV2GarmentConfig(row.item)!;
    const missingRegions = config.occludeBodyRegions.filter(region => !available.has(region));
    if (missingRegions.length) {
      throw new Error(`${row.item.name} could not find Avatar V2 body region(s) to occlude: ${missingRegions.join(', ')}`);
    }
    config.occludeBodyRegions.forEach(region => hidden.add(region));
  }

  try {
    for (const row of clothing) {
      const config = avatarV2GarmentConfig(row.item)!;
      const file = avatarV2GarmentFile(row.item, frame, lod)!;
      const source = library.get(file);
      if (!source) throw new Error(`Avatar V2 garment was not preloaded: ${file}`);

      const counts = garmentMeshCount(source);
      if (!counts.skinned) throw new Error(`${row.item.name} V2 garment has no skinned mesh.`);
      if (counts.unskinned) {
        throw new Error(`${row.item.name} V2 garment contains ${counts.unskinned} unskinned mesh(es); rigid details must be bone weighted.`);
      }

      source.updateMatrixWorld(true);
      const itemGroup = new T.Group();
      itemGroup.name = `avatar-v2-garment-${row.item.curated_asset_key || row.item.id}`;

      source.traverse(node => {
        if (!(node instanceof T.SkinnedMesh)) return;
        const mesh = clone(node) as T.SkinnedMesh;
        mesh.geometry = node.geometry.clone();
        mesh.material = Array.isArray(node.material)
          ? node.material.map(ownMaterial)
          : ownMaterial(node.material);

        const bound = node.skeleton.bones.map(donor => {
          const exact = target.exact.get(donor.name) ?? target.cleaned.get(clean(donor.name));
          if (exact) return exact;
          const runtimeName = avatarV2RuntimeBoneName(donor.name);
          const normalized = target.exact.get(runtimeName) ?? target.cleaned.get(clean(runtimeName));
          if (!normalized) throw new Error(`${row.item.name} V2 garment uses unknown avatar bone: ${donor.name}`);
          return normalized;
        });

        const relative = node.matrixWorld.clone();
        relative.decompose(mesh.position, mesh.quaternion, mesh.scale);
        mesh.bind(
          new T.Skeleton(bound, node.skeleton.boneInverses.map(matrix => matrix.clone())),
          node.bindMatrix.clone(),
        );
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        mesh.userData.rockmundoAvatarV2Garment = true;
        applyVariant(mesh, row, config);
        itemGroup.add(mesh);
      });

      group.add(itemGroup);
    }
  } catch (error) {
    disposeModel(group);
    throw error;
  }

  applyBodyOcclusion(avatarRoot, [...hidden]);
  return { group, hiddenBodyRegions: [...hidden] };
}
