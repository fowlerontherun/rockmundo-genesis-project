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

describe('Avatar V2 compatibility layer', () => {
  it('collects the normalized runtime rig used by shared appearance systems', () => {
    const root = rig();
    const bones = avatarV2BoneMap(root);
    expect(bones.get('Head')).toBeInstanceOf(T.Bone);
    expect(bones.get('Hand.L')).toBeInstanceOf(T.Bone);
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
