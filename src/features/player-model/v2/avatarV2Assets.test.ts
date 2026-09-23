import { describe, expect, it } from 'vitest';
import { avatarV2AssetUrl, isAvatarV2AssetFile } from './avatarV2Assets';

describe('Avatar V2 public asset resolver', () => {
  it('keeps V2 assets outside the legacy gig-demo-3d directory', () => {
    expect(isAvatarV2AssetFile('avatar-v2/masculine/base-lod0.glb')).toBe(true);
    expect(isAvatarV2AssetFile('casual.glb')).toBe(false);
    const url = avatarV2AssetUrl('avatar-v2/masculine/base-lod0.glb');
    expect(url).toContain('avatar-v2/masculine/base-lod0.glb');
    expect(url).not.toContain('gig-demo-3d');
  });

  it('rejects non-V2 paths', () => {
    expect(() => avatarV2AssetUrl('clothing/test.glb')).toThrow(/avatar-v2/);
  });
});
