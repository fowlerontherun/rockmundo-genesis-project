import { describe, expect, it } from 'vitest';
import { defaultAppearance } from './appearance';
import { avatarSkinNormalTexture, avatarSkinRoughnessTexture } from './avatarMaterialQuality';

describe('avatar material quality', () => {
  it('uses high-resolution skin maps for close-up quality tiers', () => {
    const appearance = defaultAppearance('visual-quality');
    const high = avatarSkinNormalTexture(appearance, 'high');
    const ultra = avatarSkinNormalTexture(appearance, 'ultra');
    expect(high?.image.width).toBe(512);
    expect(ultra?.image.width).toBe(1024);
    high?.dispose();
    ultra?.dispose();
  });

  it('keeps crowds free of expensive skin texture maps', () => {
    const appearance = defaultAppearance('crowd-quality');
    expect(avatarSkinNormalTexture(appearance, 'crowd')).toBeNull();
    expect(avatarSkinRoughnessTexture(appearance, 'crowd')).toBeNull();
  });

  it('adds a separate roughness surface at half skin-normal resolution', () => {
    const appearance = defaultAppearance('roughness-quality');
    appearance.head.skinDetail = 'weathered';
    const texture = avatarSkinRoughnessTexture(appearance, 'high');
    expect(texture?.image.width).toBe(256);
    texture?.dispose();
  });
});
