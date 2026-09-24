import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import type { ResolvedTattooVisual } from '../tattoos';
import {
  applyAvatarV2Compatibility,
  avatarV2BoneMap,
  avatarV2CompatibilityHairQuality,
  avatarV2HeadAccessoryFit,
} from './avatarV2Compatibility';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';
  for (const name of ['Hips', 'Spine1', 'Spine2', 'Neck', 'Head', 'UpperArm.L', 'LowerArm.L', 'Hand.L', 'UpperArm.R', 'LowerArm.R', 'Hand.R', 'UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R']) {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
  }
  const head = root.getObjectByName('Head') as T.Bone;
  for (const [name, position] of [
    ['Eye.L', [.07, 1.63, .17]],
    ['Eye.R', [-.07, 1.63, .17]],
    ['EarAnchor.L', [.19, 1.51, .015]],
    ['EarAnchor.R', [-.19, 1.51, .015]],
  ] as const) {
    const bone = new T.Bone();
    bone.name = name;
    bone.position.set(...position);
    head.add(bone);
  }
  root.updateMatrixWorld(true);
  return root;
}

function addHeadSurface(root: T.Group) {
  const head = root.getObjectByName('Head') as T.Bone;
  const geometry = new T.BoxGeometry(.38, .5, .34, 3, 4, 3);
  const count = geometry.attributes.position.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let index = 0; index < count; index++) weights[index * 4] = 1;
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  const material = new T.MeshStandardMaterial({ color: '#c58c63' });
  material.name = 'RMV2_Skin';
  const surface = new T.SkinnedMesh(geometry, material);
  surface.name = 'RMV2_HeadSurface';
  surface.position.y = 1.55;
  surface.bind(new T.Skeleton([head]));
  root.add(surface);
  root.updateMatrixWorld(true);
  return surface;
}

describe('Avatar V2 compatibility layer', () => {
  it('collects the normalized runtime rig used by shared appearance systems', () => {
    const root = rig();
    const bones = avatarV2BoneMap(root);
    expect(bones.get('Head')).toBeInstanceOf(T.Bone);
    expect(bones.get('Hand.L')).toBeInstanceOf(T.Bone);
  });

  it('raises only close-up V2 hair tiers while keeping balanced and crowd cost unchanged', () => {
    expect(avatarV2CompatibilityHairQuality('crowd')).toBe('crowd');
    expect(avatarV2CompatibilityHairQuality('balanced')).toBe('balanced');
    expect(avatarV2CompatibilityHairQuality('high')).toBe('ultra');
    expect(avatarV2CompatibilityHairQuality('ultra')).toBe('cinematic');
    expect(avatarV2CompatibilityHairQuality('cinematic')).toBe('cinematic');
  });

  it('uses denser V2 hair geometry and fibre detail at high quality', () => {
    const root = rig();
    addHeadSurface(root);
    const appearance = defaultAppearance('avatar-v2-hair-quality');
    appearance.head.hairStyle = 'quiff';

    applyAvatarV2Compatibility(root, appearance, [], [], 'high');

    const hair = root.getObjectByName('avatar-hairstyle') as T.Mesh;
    const material = hair.material as T.MeshPhysicalMaterial;
    expect(hair).toBeTruthy();
    expect(material).toBeInstanceOf(T.MeshPhysicalMaterial);
    expect(material.normalMap).toBeInstanceOf(T.DataTexture);
    expect((material.normalMap as T.DataTexture).image.width).toBe(512);
    expect(root.userData.rockmundoAvatarV2Compatibility.hairQuality).toBe('ultra');
  });

  it('resolves authored eye and ear attachment points from the normalized V2 rig', () => {
    const root = rig();
    const fit = avatarV2HeadAccessoryFit(root);

    expect(fit.leftEye?.distanceTo((root.getObjectByName('Eye.L') as T.Bone).getWorldPosition(new T.Vector3()))).toBeLessThan(1e-6);
    expect(fit.rightEye?.distanceTo((root.getObjectByName('Eye.R') as T.Bone).getWorldPosition(new T.Vector3()))).toBeLessThan(1e-6);
    expect(fit.leftEar?.distanceTo((root.getObjectByName('EarAnchor.L') as T.Bone).getWorldPosition(new T.Vector3()))).toBeLessThan(1e-6);
    expect(fit.rightEar?.distanceTo((root.getObjectByName('EarAnchor.R') as T.Bone).getWorldPosition(new T.Vector3()))).toBeLessThan(1e-6);
  });

  it('places V2 stud earrings on the authored ear anchors', () => {
    const root = rig();
    addHeadSurface(root);
    const appearance = defaultAppearance('avatar-v2-ear-anchor-fit');
    appearance.head.hairStyle = 'quiff';
    appearance.accessories!.leftEarring = 'studs';
    appearance.accessories!.rightEarring = 'studs';

    applyAvatarV2Compatibility(root, appearance, [], [], 'high');
    root.updateMatrixWorld(true);

    const leftAnchor = (root.getObjectByName('EarAnchor.L') as T.Bone).getWorldPosition(new T.Vector3());
    const rightAnchor = (root.getObjectByName('EarAnchor.R') as T.Bone).getWorldPosition(new T.Vector3());
    const leftStud = root.getObjectByName('avatar-earring-left-studs')!.getObjectByName('earring-stud')!;
    const rightStud = root.getObjectByName('avatar-earring-right-studs')!.getObjectByName('earring-stud')!;

    expect(leftStud.getWorldPosition(new T.Vector3()).distanceTo(leftAnchor)).toBeLessThan(1e-5);
    expect(rightStud.getWorldPosition(new T.Vector3()).distanceTo(rightAnchor)).toBeLessThan(1e-5);
    expect(root.getObjectByName('avatar-accessories')?.userData.rockmundoAccessoryFit).toEqual({
      eyeSource: 'authored-anchor',
      earSource: 'authored-anchor',
    });
  });

  it('rebuilds saved hair, glasses and independent earrings against a V2 head surface', () => {
    const root = rig();
    addHeadSurface(root);
    const appearance = defaultAppearance('avatar-v2-head-fit');
    appearance.head.hairStyle = 'quiff';
    appearance.accessories!.glasses = 'square';
    appearance.accessories!.leftEarring = 'hoops';
    appearance.accessories!.rightEarring = 'studs';

    applyAvatarV2Compatibility(root, appearance, [], [], 'balanced');

    expect(root.getObjectByName('avatar-hairstyle')).toBeTruthy();
    expect(root.getObjectByName('avatar-glasses-square')).toBeTruthy();
    expect(root.getObjectByName('avatar-earring-left-hoops')).toBeTruthy();
    expect(root.getObjectByName('avatar-earring-right-studs')).toBeTruthy();
  });

  it('renders Tattoo Parlour visuals on the normalized V2 skeleton', () => {
    const root = rig();
    const appearance = defaultAppearance('avatar-v2-tattoo');
    const tattoo: ResolvedTattooVisual = {
      id: 'tattoo-v2',
      profile_id: 'avatar-v2-tattoo',
      body_slot: 'chest',
      ink_color: '#1d232d',
      quality_score: 90,
      is_infected: false,
      category: 'musical',
    };

    applyAvatarV2Compatibility(root, appearance, [tattoo], [], 'high');

    expect(root.getObjectByName('avatar-tattoo-tattoo-v2')).toBeTruthy();
    expect(root.userData.rockmundoAvatarV2Compatibility).toMatchObject({
      tattoos: 1,
      clothing: 0,
    });
  });
});
