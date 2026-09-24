import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import {
  avatarV2MaterialRole,
  avatarV2TextureDetailQuality,
  tuneAvatarV2Materials,
} from './avatarV2Materials';

function material(name: string) {
  const result = new T.MeshStandardMaterial({ color: '#cccccc', roughness: .8 });
  result.name = name;
  return result;
}

describe('Avatar V2 material quality', () => {
  it('classifies close-up material roles without confusing cornea and iris with skin', () => {
    expect(avatarV2MaterialRole('RMV2_Skin')).toBe('skin');
    expect(avatarV2MaterialRole('RMV2_Iris')).toBe('iris');
    expect(avatarV2MaterialRole('RMV2_Cornea')).toBe('cornea');
    expect(avatarV2MaterialRole('RMV2_Wetline')).toBe('wetline');
    expect(avatarV2MaterialRole('RMV2_Teeth')).toBe('teeth');
    expect(avatarV2MaterialRole('RMV2_Tongue')).toBe('tongue');
    expect(avatarV2MaterialRole('RMV2_MouthInterior')).toBe('mouthInterior');
  });

  it('preserves authored V2 skin maps instead of replacing them with procedural fallback textures', () => {
    const root = new T.Group();
    const skin = material('RMV2_Skin');
    const authoredNormal = new T.Texture();
    const authoredRoughness = new T.Texture();
    skin.normalMap = authoredNormal;
    skin.roughnessMap = authoredRoughness;
    const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), skin);
    root.add(mesh);

    tuneAvatarV2Materials(root, defaultAppearance('v2-authored-skin-test'), 'ultra');

    const tuned = mesh.material as T.MeshPhysicalMaterial;
    expect(tuned).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(tuned.normalMap).toBe(authoredNormal);
    expect(tuned.roughnessMap).toBe(authoredRoughness);
  });

  it('uses a V2-specific texture-detail uplift without increasing balanced or crowd budgets', () => {
    expect(avatarV2TextureDetailQuality('crowd')).toBe('crowd');
    expect(avatarV2TextureDetailQuality('balanced')).toBe('balanced');
    expect(avatarV2TextureDetailQuality('high')).toBe('ultra');
    expect(avatarV2TextureDetailQuality('ultra')).toBe('cinematic');
    expect(avatarV2TextureDetailQuality('cinematic')).toBe('cinematic');

    const root = new T.Group();
    const skin = material('RMV2_Skin');
    const hair = material('RMV2_Hair');
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), [skin, hair]));

    tuneAvatarV2Materials(root, defaultAppearance('v2-texture-detail-test'), 'high');

    const tuned = (root.children[0] as T.Mesh).material as T.MeshStandardMaterial[];
    expect(tuned[0].normalMap).toBeInstanceOf(T.DataTexture);
    expect(tuned[1].normalMap).toBeInstanceOf(T.DataTexture);
    expect((tuned[0].normalMap as T.DataTexture).image.width).toBe(1024);
    expect((tuned[1].normalMap as T.DataTexture).image.width).toBe(512);
  });

  it('promotes close-up skin and hair to physical materials while preserving authored maps', () => {
    const root = new T.Group();
    const skin = material('RMV2_Skin');
    const hair = material('RMV2_Hair');
    const skinMap = new T.Texture();
    const hairMap = new T.Texture();
    skin.map = skinMap;
    hair.map = hairMap;
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), [skin, hair]));

    tuneAvatarV2Materials(root, defaultAppearance('v2-physical-surface-test'), 'high');

    const tuned = (root.children[0] as T.Mesh).material as T.Material[];
    const tunedSkin = tuned[0] as T.MeshPhysicalMaterial;
    const tunedHair = tuned[1] as T.MeshPhysicalMaterial;
    expect(tunedSkin).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(tunedHair).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(tunedSkin.map).toBe(skinMap);
    expect(tunedHair.map).toBe(hairMap);
    expect(tunedSkin.specularIntensity).toBeGreaterThan(.2);
    expect(tunedSkin.sheen).toBeGreaterThan(0);
    expect(tunedHair.anisotropy).toBeGreaterThan(.5);
    expect(tunedHair.sheen).toBeGreaterThan(.1);
  });

  it('keeps promoted materials when a mixed mesh already contains physical surfaces', () => {
    const root = new T.Group();
    const skin = material('RMV2_Skin');
    const hair = new T.MeshPhysicalMaterial({ color: '#333333' });
    hair.name = 'RMV2_Hair';
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), [skin, hair]));

    tuneAvatarV2Materials(root, defaultAppearance('v2-mixed-material-test'), 'high');

    const tuned = (root.children[0] as T.Mesh).material as T.Material[];
    expect(tuned[0]).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(tuned[1]).toBe(hair);
  });

  it('keeps balanced-distance skin on the cheaper standard shader path', () => {
    const root = new T.Group();
    const skin = material('RMV2_Skin');
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), skin));

    tuneAvatarV2Materials(root, defaultAppearance('v2-balanced-material-test'), 'balanced');

    expect((root.children[0] as T.Mesh).material).toBeInstanceOf(T.MeshStandardMaterial);
    expect((root.children[0] as T.Mesh).material).not.toBeInstanceOf(T.MeshPhysicalMaterial);
  });

  it('applies skin micro-detail and distinct close-up eye and mouth shading', () => {
    const root = new T.Group();
    const materials = [
      material('RMV2_Skin'),
      material('RMV2_Iris'),
      material('RMV2_Sclera'),
      material('RMV2_Cornea'),
      material('RMV2_Wetline'),
      material('RMV2_Teeth'),
      material('RMV2_Tongue'),
      material('RMV2_MouthInterior'),
    ];
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), materials));

    const appearance = defaultAppearance('v2-material-test');
    appearance.body.skin = '#b9785a';
    appearance.head.eyeColor = '#3d6f83';

    const report = tuneAvatarV2Materials(root, appearance, 'high');
    const tuned = (root.children[0] as T.Mesh).material as T.Material[];
    const skin = tuned[0] as T.MeshStandardMaterial;
    const iris = tuned[1] as T.MeshStandardMaterial;
    const sclera = tuned[2] as T.MeshStandardMaterial;
    const cornea = tuned[3] as T.MeshPhysicalMaterial;
    const wetline = tuned[4] as T.MeshPhysicalMaterial;
    const teeth = tuned[5] as T.MeshStandardMaterial;
    const tongue = tuned[6] as T.MeshStandardMaterial;
    const mouth = tuned[7] as T.MeshStandardMaterial;

    expect(skin).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(skin.normalMap).toBeInstanceOf(T.Texture);
    expect(skin.roughnessMap).toBeInstanceOf(T.Texture);
    expect((skin as T.MeshPhysicalMaterial).specularIntensity).toBeGreaterThan(.2);
    expect(iris.color.getHexString()).toBe('3d6f83');
    expect(sclera.color.getHexString()).toBe('f2eee8');
    expect(cornea).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(cornea.clearcoat).toBe(1);
    expect(cornea.ior).toBeCloseTo(1.376);
    expect(wetline).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(wetline.transparent).toBe(true);
    expect(wetline.opacity).toBeGreaterThan(.4);
    expect(wetline.ior).toBeCloseTo(1.336);
    expect(wetline.depthWrite).toBe(false);
    expect(teeth).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(tongue).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(teeth.color.getHexString()).toBe('f3eadc');
    expect(tongue.color.getHexString()).toBe('9e4f58');
    expect((teeth as T.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(.2);
    expect((tongue as T.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(.1);
    expect(mouth.color.getHexString()).toBe('35171c');
    expect(report.skin).toBe(1);
    expect(report.eyes).toBe(4);
    expect(report.mouth).toBe(3);
    expect(report.corneaPromoted).toBe(1);
  });
});
