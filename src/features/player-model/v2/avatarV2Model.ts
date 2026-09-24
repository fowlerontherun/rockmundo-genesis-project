import * as T from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { PlayerAppearance } from '../appearance';
import type { AvatarVisualQuality } from '../avatarVisualQuality';
import type { ModelLibrary } from '../model';
import {
  AVATAR_V2_CLOSEUP_BONE_ALIASES,
  AVATAR_V2_CLOSEUP_RUNTIME_BONE_NAMES,
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
import { tuneAvatarV2Materials } from './avatarV2Materials';


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

  const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const byClean = new Map<string, T.Bone>();
  root.traverse(node => {
    if (node instanceof T.Bone) byClean.set(clean(node.name), node);
  });
  for (const [semantic, aliases] of Object.entries(AVATAR_V2_CLOSEUP_BONE_ALIASES) as [
    keyof typeof AVATAR_V2_CLOSEUP_BONE_ALIASES,
    readonly string[],
  ][]) {
    const match = aliases.map(alias => byClean.get(clean(alias))).find(Boolean);
    if (match) match.name = AVATAR_V2_CLOSEUP_RUNTIME_BONE_NAMES[semantic];
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

function avatarV2DefaultQualityForLod(lod: AvatarV2Lod): AvatarVisualQuality {
  if (lod === 0) return 'ultra';
  if (lod === 1) return 'high';
  if (lod === 2) return 'balanced';
  return 'crowd';
}

export function prepareAvatarV2CandidateModel(
  source: T.Object3D,
  appearance: PlayerAppearance,
  lod: AvatarV2Lod,
  quality: AvatarVisualQuality = avatarV2DefaultQualityForLod(lod),
): AvatarV2AssemblyResult {
  const model = clone(source);
  const report = validateAvatarV2Scene(model, appearance.body.frame, lod);
  if (!report.valid) {
    return { model: null, report, reason: 'Avatar V2 asset failed the runtime mesh contract.' };
  }

  ownV2MeshResources(model);
  normalizeRigNames(model, report);
  tuneAvatarV2Materials(model, appearance, quality);
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

  return prepareAvatarV2CandidateModel(source, appearance, lod, quality);
}
