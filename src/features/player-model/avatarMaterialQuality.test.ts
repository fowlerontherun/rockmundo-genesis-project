import { describe, expect, it } from 'vitest';
import { defaultAppearance } from './appearance';
import { applyAvatarHairQuality, avatarHairNormalTexture, avatarHairRoughnessTexture, avatarSkinNormalTexture, avatarSkinRoughnessTexture, createAvatarHairTextureCache } from './avatarMaterialQuality';

describe('avatar material quality', () => {
  it('uses high-resolution skin maps for close-up quality tiers', () => {
    const appearance = defaultAppearance('visual-quality');
    const high = avatarSkinNormalTexture(appearance, 'high');
    const ultra = avatarSkinNormalTexture(appearance, 'ultra');
    const cinematic = avatarSkinNormalTexture(appearance, 'cinematic');
    expect(high?.image.width).toBe(512);
    expect(ultra?.image.width).toBe(1024);
    expect(cinematic?.image.width).toBe(2048);
    high?.dispose();
    ultra?.dispose();
    cinematic?.dispose();
  });

  it('keeps crowds free of expensive skin texture maps', () => {
    const appearance = defaultAppearance('crowd-quality');
    expect(avatarSkinNormalTexture(appearance, 'crowd')).toBeNull();
    expect(avatarSkinRoughnessTexture(appearance, 'crowd')).toBeNull();
  });

  it('adds high-resolution strand maps for close-up hair', () => {
    const high = avatarHairNormalTexture('high');
    const ultra = avatarHairRoughnessTexture('ultra');
    const cinematic = avatarHairRoughnessTexture('cinematic');
    expect(high?.image.width).toBe(256);
    expect(ultra?.image.width).toBe(512);
    expect(cinematic?.image.width).toBe(1024);
    high?.dispose();
    ultra?.dispose();
    cinematic?.dispose();
  });

  it('reuses one high-resolution hair surface across avatar material groups', () => {
    const cache = createAvatarHairTextureCache('ultra');
    const first = new (require('three').MeshStandardMaterial)();
    const second = new (require('three').MeshStandardMaterial)();
    applyAvatarHairQuality(first, 'ultra', cache);
    applyAvatarHairQuality(second, 'ultra', cache);
    expect(first.normalMap).toBe(second.normalMap);
    expect(first.roughnessMap).toBe(second.roughnessMap);
    cache.normal?.dispose();
    cache.roughness?.dispose();
  });

  it('adds a separate roughness surface at half skin-normal resolution', () => {
    const appearance = defaultAppearance('roughness-quality');
    appearance.head.skinDetail = 'weathered';
    const texture = avatarSkinRoughnessTexture(appearance, 'high');
    expect(texture?.image.width).toBe(256);
    texture?.dispose();
  });
});
