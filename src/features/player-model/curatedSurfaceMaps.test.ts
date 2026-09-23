import { describe, expect, it } from 'vitest';
import { curatedBumpScale, curatedReliefTexture, curatedRoughnessTexture } from './curatedSurfaceMaps';

describe('curated surface maps', () => {
  it('builds high-resolution deterministic relief for current curated items', () => {
    const texture = curatedReliefTexture('clothing.punk.biker-jacket', 'leather');
    expect(texture.image.width).toBe(256);
    expect(texture.image.height).toBe(256);
    expect(texture.name).toContain('clothing.punk.biker-jacket');
    texture.dispose();
  });

  it('builds a separate roughness map so stage light reveals material variation', () => {
    const texture = curatedRoughnessTexture('clothing.starter.dark-slim-jeans', 'denim');
    expect(texture.image.width).toBe(128);
    expect(texture.image.height).toBe(128);
    texture.dispose();
  });

  it('keeps relief subtle for polished leather and stronger for canvas/denim', () => {
    expect(curatedBumpScale('polished-leather')).toBeLessThan(curatedBumpScale('leather'));
    expect(curatedBumpScale('canvas')).toBeGreaterThan(curatedBumpScale('cotton'));
    expect(curatedBumpScale('denim')).toBeGreaterThan(curatedBumpScale('cotton'));
  });
});
