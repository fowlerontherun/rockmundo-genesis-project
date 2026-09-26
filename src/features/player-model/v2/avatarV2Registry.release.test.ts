import { describe, expect, it } from 'vitest';
import { AVATAR_V2_BASE_ASSETS, avatarV2ReleaseBlockers } from './avatarV2Registry';

describe('Avatar V2 release diagnostics', () => {
  it('reports all eight unvalidated production assets without enabling rollout', () => {
    const blockers = avatarV2ReleaseBlockers();
    expect(blockers.filter(reason => reason.includes('production asset not validated'))).toHaveLength(8);
  });

  it('accepts a complete, unique validated manifest', () => {
    const assets = AVATAR_V2_BASE_ASSETS.map(asset => ({ ...asset, status: 'validated' as const }));
    expect(avatarV2ReleaseBlockers(assets)).toEqual([]);
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
