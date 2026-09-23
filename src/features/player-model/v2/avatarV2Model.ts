import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { PlayerAppearance } from '../appearance';
import type { AvatarVisualQuality } from '../avatarVisualQuality';
import type { ModelLibrary } from '../model';
import {
  AVATAR_V2_REQUIRED_BONES,
  AVATAR_V2_RUNTIME_BONE_NAMES,
  validateAvatarV2Scene,
  type AvatarV2Lod,
  type AvatarV2ValidationReport,
} from './avatarV2Contract';
import {
  AVATAR_V2_ROLLOUT,
  validatedAvatarV2Asset,
} from './avatarV2Registry';
import { applyAvatarV2Customization } from './avatarV2Customization';


export function avatarV2LodForQuality(quality: AvatarVisualQuality): AvatarV2Lod {
  if (quality === 'cinematic' || quality === 'ultra') return 0;
  if (quality === 'high') return 1;
  if (quality === 'balanced') return 2;
  return 3;
}

export function requiredAvatarV2ModelFiles(
  appearances: PlayerAppearance[],
  quality: AvatarVisualQuality,
) {
  if (!AVATAR_V2_ROLLOUT.enabled) return [];
  const lod = avatarV2LodForQuality(quality);
  return [...new Set(appearances.map(appearance => validatedAvatarV2Asset(appearance.body.frame, lod)?.file).filter(Boolean) as string[])];
}

function materialName(material: T.Material) {
  return material.name.toLowerCase();
}

function ownV2MeshResources(root: T.Object3D) {
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    // SkeletonUtils shares geometry, materials and textures. The assembled model
    // is disposed after the stage performer clones it, so it must own every
    // disposable GPU resource rather than invalidating the cached source GLB.
    node.geometry = node.geometry.clone();
    const ownMaterial = (source: T.Material) => {
      const material = source.clone();
      for (const key of ['map','normalMap','roughnessMap','bumpMap','metalnessMap','alphaMap','aoMap','emissiveMap'] as const) {
        const value = (material as T.MeshStandardMaterial)[key];
        if (value instanceof T.Texture) (material as T.MeshStandardMaterial)[key] = value.clone();
      }
      return material;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(ownMaterial)
      : ownMaterial(node.material);
  });
}

function tuneV2Materials(root: T.Object3D, appearance: PlayerAppearance) {
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!(material instanceof T.MeshStandardMaterial)) continue;
      const name = materialName(material);
      if (/skin|body|face/.test(name)) {
        material.color.set(appearance.body.skin);
        material.roughness = Math.min(.72, material.roughness || .72);
      } else if (/hair|brow/.test(name)) {
        material.color.set(appearance.head.hair);
        material.roughness = Math.min(.58, material.roughness || .58);
      } else if (/iris/.test(name)) {
        material.color.set(appearance.head.eyeColor ?? '#65442d');
        material.roughness = .22;
      }
      material.needsUpdate = true;
    }
  });
}

function normalizeRigNames(root: T.Object3D, report: AvatarV2ValidationReport) {
  const byOriginal = new Map<string, T.Bone>();
  root.traverse(node => {
    if (node instanceof T.Bone) byOriginal.set(node.name, node);
  });

  for (const canonical of AVATAR_V2_REQUIRED_BONES) {
    const sourceName = report.boneMap[canonical];
    if (!sourceName) continue;
    const bone = byOriginal.get(sourceName);
    if (bone) bone.name = AVATAR_V2_RUNTIME_BONE_NAMES[canonical];
  }
}

function normalizeScale(root: T.Object3D, appearance: PlayerAppearance) {
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root);
  const size = box.getSize(new T.Vector3());
  if (!Number.isFinite(size.y) || size.y <= .1) return;

  const targetHeight = 1.78 * appearance.body.height;
  const factor = targetHeight / size.y;
  root.scale.setScalar(factor);
  root.updateMatrixWorld(true);

  const scaled = new T.Box3().setFromObject(root);
  if (Number.isFinite(scaled.min.y)) root.position.y -= scaled.min.y;

  // The final V2 authoring pipeline will replace this conservative root-width
  // adjustment with authored body morph targets. Do not distort the skeleton.
  const build = T.MathUtils.clamp(appearance.body.build, .9, 1.1);
  root.userData.rockmundoBodyBuild = build;
}

export interface AvatarV2AssemblyResult {
  model: T.Object3D | null;
  report: AvatarV2ValidationReport | null;
  reason?: string;
}

export function prepareAvatarV2CandidateModel(
  source: T.Object3D,
  appearance: PlayerAppearance,
  lod: AvatarV2Lod,
): AvatarV2AssemblyResult {
  const model = clone(source);
  const report = validateAvatarV2Scene(model, appearance.body.frame, lod);
  if (!report.valid) {
    return { model: null, report, reason: 'Avatar V2 asset failed the runtime mesh contract.' };
  }

  ownV2MeshResources(model);
  normalizeRigNames(model, report);
  tuneV2Materials(model, appearance);
  applyAvatarV2Customization(model, appearance);
  normalizeScale(model, appearance);
  model.name = `rockmundo-avatar-v2-${appearance.body.frame}-lod${lod}`;
  model.userData.rockmundoAvatarEngine = 'rockmundo-v2';
  model.userData.rockmundoAvatarV2 = {
    ...(model.userData.rockmundoAvatarV2 ?? {}),
    version: '2.0',
    frame: appearance.body.frame,
    lod,
  };
  return { model, report };
}

/**
 * Safe opt-in path for the new mesh system. Until the registry marks an asset
 * validated and rollout is enabled, every production surface continues using V1.
 */
export function tryAssembleAvatarV2Model(
  library: ModelLibrary,
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
  options: { force?: boolean } = {},
): AvatarV2AssemblyResult {
  const lod = avatarV2LodForQuality(quality);
  const asset = validatedAvatarV2Asset(appearance.body.frame, lod);
  if (!asset) return { model: null, report: null, reason: `No validated Avatar V2 LOD${lod} asset for ${appearance.body.frame}.` };
  if (!AVATAR_V2_ROLLOUT.enabled && !options.force) {
    return { model: null, report: null, reason: 'Avatar V2 rollout is not enabled.' };
  }

  const source = library.get(asset.file);
  if (!source) return { model: null, report: null, reason: `Avatar V2 asset was not preloaded: ${asset.file}` };

  return prepareAvatarV2CandidateModel(source, appearance, lod);
}
