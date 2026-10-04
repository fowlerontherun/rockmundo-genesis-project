import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { fabricNormalTexture, fabricTexture, fabricUVs } from './fabrics';

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


it.each([false, true])('matches pattern scale across metre/Y-up and scaled/Z-up donors (footwear=%s)', footwear => {
  const body = new T.BufferGeometry();
  body.setAttribute('position', new T.Float32BufferAttribute([-.2, .3, .1, .2, 1.2, -.1, 0, .8, .15], 3));
  const frame = new T.Matrix4().makeRotationX(-Math.PI / 2).scale(new T.Vector3(100,100,100));
  const exported = body.clone().applyMatrix4(frame.clone().invert());
  const positions = Array.from(exported.getAttribute('position').array);
  fabricUVs(body, footwear);
  fabricUVs(exported, footwear, frame);
  const expected = body.getAttribute('uv'), actual = exported.getAttribute('uv');
  for (let i = 0; i < expected.count; i++) {
    expect(actual.getX(i)).toBeCloseTo(expected.getX(i), 5);
    expect(actual.getY(i)).toBeCloseTo(expected.getY(i), 5);
  }
  expect(Array.from(exported.getAttribute('position').array)).toEqual(positions);
  body.dispose(); exported.dispose();
});
