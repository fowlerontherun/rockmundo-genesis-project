import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import {
  avatarV2MaterialRole,
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
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), skin));

    tuneAvatarV2Materials(root, defaultAppearance('v2-authored-skin-test'), 'ultra');

    expect(skin.normalMap).toBe(authoredNormal);
    expect(skin.roughnessMap).toBe(authoredRoughness);
  });

  it('applies skin micro-detail and distinct close-up eye and mouth shading', () => {
    const root = new T.Group();
    const materials = [
      material('RMV2_Skin'),
      material('RMV2_Iris'),
      material('RMV2_Sclera'),
      material('RMV2_Cornea'),
      material('RMV2_Teeth'),
      material('RMV2_Tongue'),
      material('RMV2_MouthInterior'),
    ];
    root.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), materials));

    const appearance = defaultAppearance('v2-material-test');
    appearance.body.skin = '#b9785a';
    appearance.head.eyeColor = '#3d6f83';

    const report = tuneAvatarV2Materials(root, appearance, 'balanced');
    const tuned = (root.children[0] as T.Mesh).material as T.Material[];
    const skin = tuned[0] as T.MeshStandardMaterial;
    const iris = tuned[1] as T.MeshStandardMaterial;
    const sclera = tuned[2] as T.MeshStandardMaterial;
    const cornea = tuned[3] as T.MeshPhysicalMaterial;
    const teeth = tuned[4] as T.MeshStandardMaterial;
    const tongue = tuned[5] as T.MeshStandardMaterial;
    const mouth = tuned[6] as T.MeshStandardMaterial;

    expect(skin.normalMap).toBeInstanceOf(T.Texture);
    expect(skin.roughnessMap).toBeInstanceOf(T.Texture);
    expect(iris.color.getHexString()).toBe('3d6f83');
    expect(sclera.color.getHexString()).toBe('f2eee8');
    expect(cornea).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(cornea.clearcoat).toBe(1);
    expect(cornea.ior).toBeCloseTo(1.376);
    expect(teeth.color.getHexString()).toBe('f3eadc');
    expect(tongue.color.getHexString()).toBe('9e4f58');
    expect(mouth.color.getHexString()).toBe('35171c');
    expect(report.skin).toBe(1);
    expect(report.eyes).toBe(3);
    expect(report.mouth).toBe(3);
    expect(report.corneaPromoted).toBe(1);
  });
});
