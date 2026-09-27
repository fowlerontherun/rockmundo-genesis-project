import { describe, expect, it } from 'vitest';
import { isAvatarV2PreviewSkinMaterial } from './avatarV2PreviewMaterials';

describe('Avatar V2 preview skin material identification', () => {
  it('recognises both real Blender body skin exports', () => {
    expect(isAvatarV2PreviewSkinMaterial('RMV2_Preview_Skin_masculine')).toBe(true);
    expect(isAvatarV2PreviewSkinMaterial('RMV2_Preview_Skin_feminine')).toBe(true);
  });

  it('never recolours lips, eyes, lashes or brows', () => {
    for (const name of [
      'RMV2_Preview_Iris_masculine_L', 'RMV2_Preview_Sclera_feminine_R',
      'RMV2_Preview_Skin_Lips', 'RMV2_Preview_Cornea_masculine_L',
      'RMV2_Preview_Brow_feminine_L', 'RMV2_Preview_Lashes_feminine_R',
    ]) expect(isAvatarV2PreviewSkinMaterial(name)).toBe(false);
  });
});
