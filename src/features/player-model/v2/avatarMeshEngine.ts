import type * as T from 'three';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import type { ResolvedTattooVisual } from '../tattoos';
import type { PlayerAppearance } from '../appearance';
import type { AvatarVisualQuality } from '../avatarVisualQuality';
import {
  assemblePlayerModel,
  disposeModel,
  requiredModelFiles,
  type ModelLibrary,
} from '../model';
import {
  avatarV2LodForQuality,
  requiredAvatarV2ModelFiles,
  tryAssembleAvatarV2Model,
} from './avatarV2Model';
import { avatarV2ClothingCompatibilityReason, buildAvatarV2Garments } from './avatarV2Garments';

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
  appearance: PlayerAppearance,
  quality: AvatarVisualQuality,
  clothing: ResolvedEquippedClothing[],
  tattoos: ResolvedTattooVisual[],
) {
  if (tattoos.length) return 'Avatar V2 tattoo projection has not been enabled yet.';
  return avatarV2ClothingCompatibilityReason(
    clothing,
    appearance.body.frame,
    avatarV2LodForQuality(quality),
  );
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
  let incompatible = v2CompatibilityReason(appearance, quality, clothing, tattoos);

  if (wantsV2 && !incompatible) {
    const result = tryAssembleAvatarV2Model(
      library,
      appearance,
      quality,
      { force: options.forceEngine === 'rockmundo-v2' },
    );
    if (result.model) {
      try {
        if (clothing.length) {
          const garments = buildAvatarV2Garments(
            library,
            result.model,
            clothing,
            appearance.body.frame,
            avatarV2LodForQuality(quality),
          );
          result.model.add(garments.group);
          result.model.userData.rockmundoAvatarV2OccludedBodyRegions = garments.hiddenBodyRegions;
        }
        result.model.userData.rockmundoAvatarEngine = 'rockmundo-v2';
        result.model.userData.rockmundoAvatarV2Report = result.report;
        return result.model;
      } catch (error) {
        disposeModel(result.model);
        incompatible = error instanceof Error ? error.message : 'Avatar V2 garment assembly failed.';
      }
    }
  }

  const legacy = assemblePlayerModel(library, appearance, tattoos, clothing, quality);
  legacy.userData.rockmundoAvatarEngine = 'legacy-v1';
  legacy.userData.rockmundoAvatarFallbackReason = incompatible ?? 'Avatar V2 is not validated/enabled for this frame and quality.';
  return legacy;
}
