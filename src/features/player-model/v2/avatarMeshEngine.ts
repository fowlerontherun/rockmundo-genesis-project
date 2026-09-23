import type * as T from 'three';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { ResolvedTattooVisual } from '../tattoos';
import type { PlayerAppearance } from '../appearance';
import type { AvatarVisualQuality } from '../avatarVisualQuality';
import {
  assemblePlayerModel,
  requiredModelFiles,
  type ModelLibrary,
} from '../model';
import {
  requiredAvatarV2ModelFiles,
  tryAssembleAvatarV2Model,
} from './avatarV2Model';

export type AvatarMeshEngine = 'legacy-v1' | 'rockmundo-v2';

export interface AvatarMeshAssemblyOptions {
  forceEngine?: AvatarMeshEngine;
}

export function requiredAvatarMeshFiles(
  appearances: PlayerAppearance[],
  quality: AvatarVisualQuality,
) {
  // Keep V1 loaded while V2 is in rollout so a malformed/missing V2 asset can
  // fail closed to the proven live model without breaking the fitting room/gig.
  return [...new Set([
    ...requiredModelFiles(appearances),
    ...requiredAvatarV2ModelFiles(appearances, quality),
  ])];
}

function v2CompatibilityReason(
  clothing: ResolvedEquippedClothing[],
  tattoos: ResolvedTattooVisual[],
) {
  if (clothing.length) return 'Avatar V2 garment adapter has not been enabled yet.';
  if (tattoos.length) return 'Avatar V2 tattoo projection has not been enabled yet.';
  return null;
}

/**
 * Single entry point for the mesh migration. Production keeps V1 until the V2
 * registry, contract and compatibility gates all pass; callers do not need a
 * second avatar pipeline when rollout begins.
 */
export function assembleAvatarMesh(
  library: ModelLibrary,
  appearance: PlayerAppearance,
  tattoos: ResolvedTattooVisual[] = [],
  clothing: ResolvedEquippedClothing[] = [],
  quality: AvatarVisualQuality = 'balanced',
  options: AvatarMeshAssemblyOptions = {},
): T.Object3D {
  const wantsV2 = options.forceEngine === 'rockmundo-v2' || options.forceEngine == null;
  const incompatible = v2CompatibilityReason(clothing, tattoos);

  if (wantsV2 && !incompatible) {
    const result = tryAssembleAvatarV2Model(
      library,
      appearance,
      quality,
      { force: options.forceEngine === 'rockmundo-v2' },
    );
    if (result.model) {
      result.model.userData.rockmundoAvatarEngine = 'rockmundo-v2';
      result.model.userData.rockmundoAvatarV2Report = result.report;
      return result.model;
    }
  }

  const legacy = assemblePlayerModel(library, appearance, tattoos, clothing, quality);
  legacy.userData.rockmundoAvatarEngine = 'legacy-v1';
  legacy.userData.rockmundoAvatarFallbackReason = incompatible ?? 'Avatar V2 is not validated/enabled for this frame and quality.';
  return legacy;
}
