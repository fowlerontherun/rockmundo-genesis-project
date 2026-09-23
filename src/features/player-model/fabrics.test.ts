import { describe, expect, it } from 'vitest';
import { fabricNormalTexture, fabricTexture } from './fabrics';

describe('starter fabric visual quality', () => {
  it('scales starter fabric albedo with avatar quality', () => {
    const crowd = fabricTexture('denim', 'crowd');
    const high = fabricTexture('denim', 'high');
    expect(crowd.image.width).toBe(128);
    expect(high.image.width).toBe(512);
    expect(high.anisotropy).toBe(8);
    crowd.dispose();
    high.dispose();
  });

  it('generates real weave normals instead of flat colour-only fabric', () => {
    const normal = fabricNormalTexture('canvas', 'high');
    const data = normal.image.data as Uint8Array;
    let varied = false;
    for (let i = 0; i < data.length; i += 4 * 37) {
      if (data[i] !== 128 || data[i + 1] !== 128) {
        varied = true;
        break;
      }
    }
    expect(varied).toBe(true);
    expect(normal.colorSpace).toBe('');
    normal.dispose();
  });
});
