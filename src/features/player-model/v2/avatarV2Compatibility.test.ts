import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { defaultAppearance } from '../appearance';
import type { ResolvedTattooVisual } from '../tattoos';
import { applyAvatarV2Compatibility, avatarV2BoneMap } from './avatarV2Compatibility';

function rig() {
  const root = new T.Group();
  root.userData.rockmundoAvatarEngine = 'rockmundo-v2';
  for (const name of ['Hips', 'Spine1', 'Spine2', 'Neck', 'Head', 'UpperArm.L', 'LowerArm.L', 'Hand.L', 'UpperArm.R', 'LowerArm.R', 'Hand.R', 'UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R']) {
    const bone = new T.Bone();
    bone.name = name;
    root.add(bone);
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
