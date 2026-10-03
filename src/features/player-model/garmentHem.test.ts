import { expect, it } from 'vitest';
import * as T from 'three';
import { clipGarmentHem } from './garmentHem';

it('creates matching level hems with normalized skinning on both sides of a cut', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, 2, 0], 3));
  geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute([0,0,0,0, 1,0,0,0, 2,0,0,0], 4));
  geometry.setAttribute('skinWeight', new T.Float32BufferAttribute([1,0,0,0, 1,0,0,0, 1,0,0,0], 4));
  const edges: number[][] = [];
  for (const above of [true, false]) {
    const clipped = clipGarmentHem(geometry, 1, new Set([0]), above);
    const position = clipped.getAttribute('position'), weights = clipped.getAttribute('skinWeight');
    const edge = new Set<number>();
    for (let i = 0; i < position.count; i++) {
      expect(above ? position.getY(i) >= 1 : position.getY(i) <= 1).toBe(true);
      expect([0,1,2,3].reduce((sum,c) => sum + weights.getComponent(i,c), 0)).toBeCloseTo(1);
      if (position.getY(i) === 1) edge.add(position.getX(i));
    }
    edges.push([...edge].sort());
    clipped.dispose();
  }
  expect(edges).toEqual([[-.5,.5],[-.5,.5]]);
  expect(geometry.getAttribute('position').count).toBe(3);
  geometry.dispose();
});
