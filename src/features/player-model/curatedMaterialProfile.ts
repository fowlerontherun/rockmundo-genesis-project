import type { CuratedFinish } from './curatedSurfaceMaps';

export interface CuratedMaterialProfile {
  roughness: number;
  metalness: number;
  envMapIntensity: number;
  normalStrength: number;
  bumpMultiplier: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen: number;
  sheenRoughness: number;
}

const byFinish: Record<CuratedFinish, CuratedMaterialProfile> = {
  cotton: { roughness: .9, metalness: 0, envMapIntensity: .88, normalStrength: .5, bumpMultiplier: .34, clearcoat: 0, clearcoatRoughness: 1, sheen: .08, sheenRoughness: .85 },
  'vintage-cotton': { roughness: .97, metalness: 0, envMapIntensity: .8, normalStrength: .56, bumpMultiplier: .38, clearcoat: 0, clearcoatRoughness: 1, sheen: .05, sheenRoughness: .9 },
  denim: { roughness: .94, metalness: 0, envMapIntensity: .9, normalStrength: .78, bumpMultiplier: .44, clearcoat: 0, clearcoatRoughness: 1, sheen: .04, sheenRoughness: .92 },
  tartan: { roughness: .9, metalness: 0, envMapIntensity: .88, normalStrength: .66, bumpMultiplier: .4, clearcoat: 0, clearcoatRoughness: 1, sheen: .06, sheenRoughness: .9 },
  canvas: { roughness: .98, metalness: 0, envMapIntensity: .78, normalStrength: .82, bumpMultiplier: .45, clearcoat: 0, clearcoatRoughness: 1, sheen: .03, sheenRoughness: .95 },
  leather: { roughness: .4, metalness: .025, envMapIntensity: 1.18, normalStrength: .68, bumpMultiplier: .42, clearcoat: .34, clearcoatRoughness: .24, sheen: .12, sheenRoughness: .6 },
  'polished-leather': { roughness: .22, metalness: .035, envMapIntensity: 1.48, normalStrength: .48, bumpMultiplier: .3, clearcoat: .7, clearcoatRoughness: .09, sheen: .08, sheenRoughness: .5 },
};

/**
 * Item-specific material tuning keeps garments made from the same donor mesh
 * from reading like simple recolours. Values are deliberately conservative:
 * geometry/rig safety is unchanged while the light response becomes distinct.
 */
export function curatedMaterialProfile(assetKey: string, finish: CuratedFinish): CuratedMaterialProfile {
  const profile = { ...byFinish[finish] };

  if (assetKey.includes('biker-jacket')) {
    profile.roughness = .33;
    profile.metalness = .035;
    profile.envMapIntensity = 1.38;
    profile.normalStrength = .74;
    profile.clearcoat = .5;
    profile.clearcoatRoughness = .16;
  }

  if (assetKey.includes('combat-boots')) {
    profile.roughness = .46;
    profile.envMapIntensity = 1.08;
    profile.normalStrength = .82;
    profile.bumpMultiplier = .48;
    profile.clearcoat = .2;
    profile.clearcoatRoughness = .32;
  }

  if (assetKey.includes('black-boots')) {
    profile.roughness = .2;
    profile.envMapIntensity = 1.55;
    profile.normalStrength = .46;
    profile.clearcoat = .76;
    profile.clearcoatRoughness = .07;
  }

  if (assetKey.includes('brown-boots')) {
    profile.roughness = .43;
    profile.envMapIntensity = 1.12;
    profile.normalStrength = .72;
    profile.clearcoat = .28;
    profile.clearcoatRoughness = .25;
  }

  if (assetKey.includes('canvas-trainers')) {
    profile.roughness = .99;
    profile.envMapIntensity = .72;
    profile.normalStrength = .86;
  }

  if (assetKey.includes('dark-slim-jeans')) {
    profile.roughness = .965;
    profile.envMapIntensity = .82;
    profile.normalStrength = .84;
  }

  if (assetKey.includes('blue-straight-jeans')) {
    profile.roughness = .93;
    profile.envMapIntensity = .9;
    profile.normalStrength = .78;
  }

  if (assetKey.includes('black-straight-jeans')) {
    profile.roughness = .95;
    profile.envMapIntensity = .84;
    profile.normalStrength = .8;
  }

  return profile;
}
