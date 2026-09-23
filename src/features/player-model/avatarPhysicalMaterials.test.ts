import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from './appearance';
import { curatedMaterialProfile } from './curatedMaterialProfile';
import { createCorneaOverlay, upgradeCuratedGarmentMaterial, upgradeSkinMaterial } from './avatarPhysicalMaterials';

function skinnedEye(materialName = 'Iris') {
  const geometry = new T.BoxGeometry(.1, .1, .02);
  const count = geometry.attributes.position.count;
  const skinIndex = new Uint16Array(count * 4);
  const skinWeight = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) skinWeight[index * 4] = 1;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight, 4));

  const bone = new T.Bone();
  bone.name = 'Head';
  const material = new T.MeshStandardMaterial({ color: '#65442d' });
  material.name = materialName;
  const mesh = new T.SkinnedMesh(geometry, material);
  mesh.bind(new T.Skeleton([bone]), new T.Matrix4());
  return mesh;
}

describe('avatar physical materials', () => {
  it('upgrades close-up skin to a soft physical sheen without changing crowd/balanced cost', () => {
    const appearance = defaultAppearance('physical-skin');
    const balanced = new T.MeshStandardMaterial({ color: appearance.body.skin });
    const high = new T.MeshStandardMaterial({ color: appearance.body.skin });

    expect(upgradeSkinMaterial(balanced, appearance, 'balanced')).toBe(balanced);
    const upgraded = upgradeSkinMaterial(high, appearance, 'high');
    expect(upgraded).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect((upgraded as T.MeshPhysicalMaterial).sheen).toBeGreaterThan(0);
  });

  it('adds clearcoat to high-quality leather but leaves low-cost materials standard', () => {
    const profile = curatedMaterialProfile('clothing.punk.biker-jacket', 'leather');
    const standard = new T.MeshStandardMaterial({ color: '#161616' });
    const upgraded = upgradeCuratedGarmentMaterial(standard, 'leather', profile, 'ultra');
    expect(upgraded).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect((upgraded as T.MeshPhysicalMaterial).clearcoat).toBeGreaterThan(.3);
  });

  it('creates a rig-bound physical cornea layer only for close-up eye groups', () => {
    const eye = skinnedEye();
    const overlay = createCorneaOverlay(eye, 'masculine', 'ultra');
    expect(overlay).toBeInstanceOf(T.SkinnedMesh);
    expect(overlay?.skeleton).toBe(eye.skeleton);
    const material = Array.isArray(overlay?.material) ? overlay!.material[0] : overlay?.material;
    expect(material).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect((material as T.MeshPhysicalMaterial).clearcoat).toBe(1);
    expect(createCorneaOverlay(eye, 'masculine', 'balanced')).toBeNull();
  });
});
