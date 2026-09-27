import { describe, expect, it } from 'vitest';
import { hasAvatarV2PreviewIrisPair, isAvatarV2PreviewIrisMaterial, isAvatarV2PreviewSkinMaterial } from './avatarV2PreviewMaterials';

describe('Avatar V2 preview skin material identification', () => {
  it('recognises both real Blender body skin exports', () => {
    expect(isAvatarV2PreviewSkinMaterial('RMV2_Preview_Skin_masculine')).toBe(true);
    expect(isAvatarV2PreviewSkinMaterial('RMV2_Preview_Skin_feminine')).toBe(true);
  });

  it('identifies only the genuine left and right iris materials', () => {
    for (const frame of ['masculine', 'feminine']) {
      for (const side of ['L', 'R']) {
        expect(isAvatarV2PreviewIrisMaterial(`RMV2_Preview_Iris_${frame}_${side}`)).toBe(true);
      }
    }
    for (const name of ['RMV2_Preview_Pupil_masculine_L', 'RMV2_Preview_Sclera_feminine_R', 'RMV2_Preview_Cornea_masculine_L', 'RMV2_Preview_Skin_feminine']) {
      expect(isAvatarV2PreviewIrisMaterial(name)).toBe(false);
    }
  });

  it('requires a real left/right iris pair rather than two duplicate left-eye materials', () => {
    expect(hasAvatarV2PreviewIrisPair(['RMV2_Preview_Iris_masculine_L', 'RMV2_Preview_Iris_masculine_R'])).toBe(true);
    expect(hasAvatarV2PreviewIrisPair(['RMV2_Preview_Iris_feminine_L', 'RMV2_Preview_Iris_feminine_L'])).toBe(false);
    expect(hasAvatarV2PreviewIrisPair(['RMV2_Preview_Iris_feminine_R', 'RMV2_Preview_Pupil_feminine_L'])).toBe(false);
  });

  it('rejects ambiguous generic skin materials and lookdev facial variants', () => {
    for (const name of ['skin', 'body_skin', 'RMV2_Preview_Skin_masculine_lips', 'RMV2_Preview_Skin_feminine.001']) {
      expect(isAvatarV2PreviewSkinMaterial(name)).toBe(false);
    }
  });

  it('never recolours lips, eyes, lashes or brows', () => {
    for (const name of [
      'RMV2_Preview_Iris_masculine_L', 'RMV2_Preview_Sclera_feminine_R',
      'RMV2_Preview_Skin_Lips', 'RMV2_Preview_Cornea_masculine_L',
      'RMV2_Preview_Brow_feminine_L', 'RMV2_Preview_Lashes_feminine_R',
    ]) expect(isAvatarV2PreviewSkinMaterial(name)).toBe(false);
  });
});
