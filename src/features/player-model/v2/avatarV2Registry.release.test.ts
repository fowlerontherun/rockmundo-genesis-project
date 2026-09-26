import { describe, expect, it } from 'vitest';
import { AVATAR_V2_BASE_ASSETS, avatarV2ReleaseBlockers, avatarV2MinimumRolloutBlockers, avatarV2Readiness } from './avatarV2Registry';

describe('Avatar V2 release diagnostics', () => {
  it('reports all eight unvalidated production assets without enabling rollout', () => {
    const blockers = avatarV2ReleaseBlockers();
    expect(blockers.filter(reason => reason.includes('production asset not validated'))).toHaveLength(8);
    expect(avatarV2Readiness().productionReady).toBe(false);
    expect(avatarV2Readiness().frames.every(frame => !frame.productionReady)).toBe(true);
  });

  it('accepts a complete, unique validated manifest', () => {
    const assets = AVATAR_V2_BASE_ASSETS.map(asset => ({ ...asset, status: 'validated' as const }));
    expect(avatarV2ReleaseBlockers(assets)).toEqual([]);
  });

  it('separates minimum LOD0/1 rollout from optional LOD2/3 completion', () => {
    const assets = AVATAR_V2_BASE_ASSETS.map(asset => ({ ...asset, status: asset.lod <= 1 ? 'validated' as const : 'planned' as const }));
    expect(avatarV2MinimumRolloutBlockers(assets)).toEqual([]);
    expect(avatarV2ReleaseBlockers(assets)).toHaveLength(4);
    expect(avatarV2MinimumRolloutBlockers([...assets, assets[0]])).toContain('masculine LOD0: expected one base asset, found 2.');
    expect(avatarV2MinimumRolloutBlockers(assets.slice(1))).toContain('masculine LOD0: expected one base asset, found 0.');
  });

  it('rejects missing, duplicated and misrouted assets', () => {
    const assets = AVATAR_V2_BASE_ASSETS.map(asset => ({ ...asset, status: 'validated' as const }));
    const missing = assets.slice(1);
    expect(avatarV2ReleaseBlockers(missing)).toContain('masculine LOD0: expected one base asset, found 0.');
    expect(avatarV2ReleaseBlockers([...assets, assets[0]])).toContain('masculine LOD0: expected one base asset, found 2.');
    const misrouted = assets.map((asset, index) => index === 0 ? { ...asset, file: assets[1].file } : asset);
    expect(avatarV2ReleaseBlockers(misrouted)).toContain('masculine LOD0: unexpected asset path.');
  });
});
