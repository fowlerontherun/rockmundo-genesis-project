import { describe, expect, it } from 'vitest';
import { curatedAlbedoTexture, curatedBumpScale, curatedNormalTexture, curatedReliefTexture, curatedRoughnessTexture, curatedTartanTexture, curatedTextureForQuality } from './curatedSurfaceMaps';

describe('curated surface maps', () => {
  it('builds high-resolution deterministic relief for current curated items', () => {
    const texture = curatedReliefTexture('clothing.punk.biker-jacket', 'leather');
    expect(texture.image.width).toBe(256);
    expect(texture.image.height).toBe(256);
    expect(texture.name).toContain('clothing.punk.biker-jacket');
    texture.dispose();
  });

  it('builds item-specific albedo detail for seams, weave and wear', () => {
    const jacket = curatedAlbedoTexture('clothing.punk.biker-jacket', 'leather');
    const jeans = curatedAlbedoTexture('clothing.starter.blue-straight-jeans', 'denim');
    expect(jacket.image.width).toBe(256);
    expect(jeans.image.width).toBe(256);
    expect(jacket.name).not.toBe(jeans.name);
    jacket.dispose();
    jeans.dispose();
  });

  it('builds true multi-tone tartan rather than a monochrome tint', () => {
    const texture = curatedTartanTexture('clothing.punk.red-tartan-trousers', '#9f2634', '#171717');
    const data = texture.image.data as Uint8Array;
    const colours = new Set<string>();
    for (let i = 0; i < data.length; i += 4 * 97) {
      colours.add(`${data[i]}-${data[i + 1]}-${data[i + 2]}`);
    }
    expect(colours.size).toBeGreaterThan(3);
    texture.dispose();
  });

  it('builds a tangent-space normal map so weave and grain react to stage lighting', () => {
    const texture = curatedNormalTexture('clothing.punk.biker-jacket', 'leather');
    expect(texture.image.width).toBe(256);
    expect(texture.image.height).toBe(256);
    expect(texture.name).toContain('curated-normal');
    texture.dispose();
  });

  it('builds a separate roughness map so stage light reveals material variation', () => {
    const texture = curatedRoughnessTexture('clothing.starter.dark-slim-jeans', 'denim');
    expect(texture.image.width).toBe(128);
    expect(texture.image.height).toBe(128);
    texture.dispose();
  });

  it('scales current clothing detail through 512px, 1024px and cinematic 2048px maps', () => {
    const high = curatedTextureForQuality(curatedAlbedoTexture('clothing.punk.biker-jacket', 'leather'), 'high', 'color');
    const ultra = curatedTextureForQuality(curatedNormalTexture('clothing.starter.blue-straight-jeans', 'denim'), 'ultra', 'normal');
    const cinematic = curatedTextureForQuality(curatedAlbedoTexture('clothing.punk.biker-jacket', 'leather'), 'cinematic', 'color');
    expect(high.image.width).toBe(512);
    expect(ultra.image.width).toBe(1024);
    expect(cinematic.image.width).toBe(2048);
    expect(high.anisotropy).toBe(8);
    expect(ultra.anisotropy).toBe(16);
    high.dispose();
    ultra.dispose();
    cinematic.dispose();
  });

  it('keeps relief subtle for polished leather and stronger for canvas/denim', () => {
    expect(curatedBumpScale('polished-leather')).toBeLessThan(curatedBumpScale('leather'));
    expect(curatedBumpScale('canvas')).toBeGreaterThan(curatedBumpScale('cotton'));
    expect(curatedBumpScale('denim')).toBeGreaterThan(curatedBumpScale('cotton'));
  });
});
