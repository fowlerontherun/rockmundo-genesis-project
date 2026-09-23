import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { applyCuratedMacroShading } from './curatedMacroShading';

function range(attribute: T.BufferAttribute) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < attribute.count; i++) {
    min = Math.min(min, attribute.getX(i));
    max = Math.max(max, attribute.getX(i));
  }
  return { min, max };
}

describe('curated macro shading', () => {
  it('adds mesh-bound construction contrast to the biker jacket', () => {
    const geometry = new T.BoxGeometry(.6, .8, .24, 12, 16, 6);
    applyCuratedMacroShading(geometry, 'clothing.punk.biker-jacket', 'leather');
    const color = geometry.getAttribute('color') as T.BufferAttribute;
    expect(color).toBeTruthy();
    const values = range(color);
    expect(values.max - values.min).toBeGreaterThan(.04);
    expect(values.min).toBeGreaterThanOrEqual(.78);
    expect(values.max).toBeLessThanOrEqual(1.12);
  });

  it('adds readable knee/thigh wear to jeans without changing geometry', () => {
    const geometry = new T.BoxGeometry(.5, 1.1, .2, 10, 20, 4);
    const before = (geometry.getAttribute('position') as T.BufferAttribute).array.slice();
    applyCuratedMacroShading(geometry, 'clothing.starter.blue-straight-jeans', 'denim');
    const after = (geometry.getAttribute('position') as T.BufferAttribute).array;
    expect(Array.from(after)).toEqual(Array.from(before));
    const values = range(geometry.getAttribute('color') as T.BufferAttribute);
    expect(values.max - values.min).toBeGreaterThan(.03);
  });

  it('gives footwear toe/sole depth without adding detached meshes', () => {
    const geometry = new T.BoxGeometry(.32, .3, .6, 8, 8, 12);
    applyCuratedMacroShading(geometry, 'clothing.punk.combat-boots', 'leather');
    expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count);
  });
});
