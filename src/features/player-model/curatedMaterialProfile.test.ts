import { describe, expect, it } from 'vitest';
import { curatedMaterialProfile } from './curatedMaterialProfile';

describe('curated material profiles', () => {
  it('makes polished black boots glossier than brown leather boots', () => {
    const black = curatedMaterialProfile('clothing.starter.black-boots', 'polished-leather');
    const brown = curatedMaterialProfile('clothing.starter.brown-boots', 'leather');
    expect(black.roughness).toBeLessThan(brown.roughness);
    expect(black.envMapIntensity).toBeGreaterThan(brown.envMapIntensity);
    expect(black.clearcoat).toBeGreaterThan(brown.clearcoat);
    expect(black.clearcoatRoughness).toBeLessThan(brown.clearcoatRoughness);
  });

  it('keeps canvas trainers matte while preserving strong woven normals', () => {
    const trainers = curatedMaterialProfile('clothing.starter.canvas-trainers', 'canvas');
    expect(trainers.roughness).toBeGreaterThan(.95);
    expect(trainers.normalStrength).toBeGreaterThan(.8);
  });

  it('gives the biker jacket a stronger leather light response than generic leather', () => {
    const biker = curatedMaterialProfile('clothing.punk.biker-jacket', 'leather');
    const generic = curatedMaterialProfile('clothing.other.leather-top', 'leather');
    expect(biker.envMapIntensity).toBeGreaterThan(generic.envMapIntensity);
    expect(biker.normalStrength).toBeGreaterThan(generic.normalStrength);
    expect(biker.clearcoat).toBeGreaterThan(generic.clearcoat);
  });
});
