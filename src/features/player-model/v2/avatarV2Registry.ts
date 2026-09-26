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
      productionReady: ([0, 1] as const).every(lod => {
        const matches = assets.filter(asset => asset.lod === lod);
        return matches.length === 1 && matches[0].status === 'validated'
          && matches[0].file === `avatar-v2/${frame}/base-lod${lod}.glb`;
      }),
    };
  });

  return {
    assetVersion: AVATAR_V2_ASSET_VERSION,
    rolloutEnabled: AVATAR_V2_ROLLOUT.enabled,
    frames,
    productionReady: avatarV2MinimumRolloutBlockers().length === 0,
  };
}

/** Read-only release diagnostics; previews and draft proofs never count as live assets. */
export function avatarV2ReleaseBlockers(assets: readonly AvatarV2BaseAsset[] = AVATAR_V2_BASE_ASSETS) {
  const blockers: string[] = [];
  const expectedFrames: AvatarV2Frame[] = ['masculine', 'feminine'];
  const expectedLods: AvatarV2Lod[] = [0, 1, 2, 3];
  const seenFiles = new Set<string>();
  for (const frame of expectedFrames) {
    for (const lod of expectedLods) {
      const entries = assets.filter(asset => asset.frame === frame && asset.lod === lod);
      if (entries.length !== 1) {
        blockers.push(`${frame} LOD${lod}: expected one base asset, found ${entries.length}.`);
        continue;
      }
      const asset = entries[0];
      if (asset.status !== 'validated') blockers.push(`${frame} LOD${lod}: ${asset.status}; production asset not validated.`);
      if (asset.file !== `avatar-v2/${frame}/base-lod${lod}.glb`) {
        blockers.push(`${frame} LOD${lod}: unexpected asset path.`);
      }
      if (seenFiles.has(asset.file)) blockers.push(`${frame} LOD${lod}: duplicate asset path.`);
      seenFiles.add(asset.file);
    }
  }
  if (assets.length !== expectedFrames.length * expectedLods.length) {
    blockers.push('Base manifest contains unexpected or duplicate entries.');
  }
  return blockers;
}

/** Minimum production meshes for the guarded rollout; remaining LODs still require separate QA. */
export function avatarV2MinimumRolloutBlockers(assets: readonly AvatarV2BaseAsset[] = AVATAR_V2_BASE_ASSETS) {
  const required = assets.filter(asset => asset.lod === 0 || asset.lod === 1);
  const blockers: string[] = [];
  for (const frame of ['masculine', 'feminine'] as const) {
    for (const lod of [0, 1] as const) {
      const entries = required.filter(asset => asset.frame === frame && asset.lod === lod);
      if (entries.length !== 1) {
        blockers.push(`${frame} LOD${lod}: expected one base asset, found ${entries.length}.`);
        continue;
      }
      const asset = entries[0];
      if (asset.status !== 'validated') blockers.push(`${frame} LOD${lod}: ${asset.status}; not validated.`);
      if (asset.file !== `avatar-v2/${frame}/base-lod${lod}.glb`) blockers.push(`${frame} LOD${lod}: unexpected asset path.`);
    }
  }
  if (required.length !== 4) blockers.push('Minimum rollout manifest contains extra or duplicate assets.');
  return blockers;
}
