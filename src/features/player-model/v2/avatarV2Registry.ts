import type { AvatarV2Frame, AvatarV2Lod } from './avatarV2Contract';

export type AvatarV2AssetStatus = 'planned' | 'asset_ready' | 'validated' | 'blocked';

export interface AvatarV2BaseAsset {
  frame: AvatarV2Frame;
  lod: AvatarV2Lod;
  file: string;
  status: AvatarV2AssetStatus;
  notes?: string;
}

export const AVATAR_V2_ASSET_VERSION = 'v2-alpha-1';

/**
 * The renderer only attempts Avatar V2 for entries marked validated.
 * This lets the new engine ship safely before the final authored meshes land.
 */
export const AVATAR_V2_BASE_ASSETS: AvatarV2BaseAsset[] = [
  { frame: 'masculine', lod: 0, file: 'avatar-v2/masculine/base-lod0.glb', status: 'planned' },
  { frame: 'masculine', lod: 1, file: 'avatar-v2/masculine/base-lod1.glb', status: 'planned' },
  { frame: 'masculine', lod: 2, file: 'avatar-v2/masculine/base-lod2.glb', status: 'planned' },
  { frame: 'masculine', lod: 3, file: 'avatar-v2/masculine/base-lod3.glb', status: 'planned' },
  { frame: 'feminine', lod: 0, file: 'avatar-v2/feminine/base-lod0.glb', status: 'planned' },
  { frame: 'feminine', lod: 1, file: 'avatar-v2/feminine/base-lod1.glb', status: 'planned' },
  { frame: 'feminine', lod: 2, file: 'avatar-v2/feminine/base-lod2.glb', status: 'planned' },
  { frame: 'feminine', lod: 3, file: 'avatar-v2/feminine/base-lod3.glb', status: 'planned' },
];

export const AVATAR_V2_ROLLOUT = {
  /**
   * Stays false until at least LOD0/1 for both frames have passed the contract.
   * Admin validation can force-load candidate assets without changing players.
   */
  enabled: false,
  assetVersion: AVATAR_V2_ASSET_VERSION,
} as const;

export function avatarV2Asset(frame: AvatarV2Frame, lod: AvatarV2Lod) {
  return AVATAR_V2_BASE_ASSETS.find(asset => asset.frame === frame && asset.lod === lod);
}

export function validatedAvatarV2Asset(frame: AvatarV2Frame, lod: AvatarV2Lod) {
  const asset = avatarV2Asset(frame, lod);
  return asset?.status === 'validated' ? asset : null;
}

export function avatarV2Readiness() {
  const frames = (['masculine', 'feminine'] as const).map(frame => {
    const assets = AVATAR_V2_BASE_ASSETS.filter(asset => asset.frame === frame);
    return {
      frame,
      planned: assets.filter(asset => asset.status === 'planned').length,
      ready: assets.filter(asset => asset.status === 'asset_ready').length,
      validated: assets.filter(asset => asset.status === 'validated').length,
      blocked: assets.filter(asset => asset.status === 'blocked').length,
      productionReady: assets.some(asset => asset.lod === 0 && asset.status === 'validated')
        && assets.some(asset => asset.lod === 1 && asset.status === 'validated'),
    };
  });

  return {
    assetVersion: AVATAR_V2_ASSET_VERSION,
    rolloutEnabled: AVATAR_V2_ROLLOUT.enabled,
    frames,
    productionReady: frames.every(frame => frame.productionReady),
  };
}
