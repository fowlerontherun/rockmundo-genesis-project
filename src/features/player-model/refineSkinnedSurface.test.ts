import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { refineSkinnedSurface } from './refineSkinnedSurface';

describe('skinned garment refinement', () => {
  it('preserves fabric UVs, material boundaries and normalized bone bindings without changing the donor', () => {
    const donor = new T.BufferGeometry();
    donor.setAttribute('position', new T.Float32BufferAttribute([0,0,0, 1,0,0, 1,1,0, 0,1,0], 3));
    donor.setAttribute('uv', new T.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1], 2));
    donor.setAttribute('skinIndex', new T.Uint16BufferAttribute([0,1,2,3, 4,5,6,7, 0,1,2,3, 4,5,6,7], 4));
    donor.setAttribute('skinWeight', new T.Float32BufferAttribute(Array(4).fill([.4,.3,.2,.1]).flat(), 4));
    donor.setIndex([0,1,2, 0,2,3]);
    donor.addGroup(0,3,0); donor.addGroup(3,3,1);
    const refined = refineSkinnedSurface(donor, 2);
    expect(donor.index?.count).toBe(6);
    expect(donor.getAttribute('position').count).toBe(4);
    expect(refined.groups.map(group => [group.count, group.materialIndex])).toEqual([[48,0],[48,1]]);
    const p = refined.getAttribute('position'), uv = refined.getAttribute('uv');
    const weights = refined.getAttribute('skinWeight'), bones = refined.getAttribute('skinIndex');
    for (let v = 0; v < p.count; v++) {
      expect(p.getZ(v)).toBe(0);
      expect(uv.getX(v)).toBeCloseTo(p.getX(v));
      expect(uv.getY(v)).toBeCloseTo(p.getY(v));
      let total = 0;
      for (let c = 0; c < 4; c++) {
        total += weights.getComponent(v,c);
        expect(Number.isInteger(bones.getComponent(v,c))).toBe(true);
        expect(bones.getComponent(v,c)).toBeLessThan(8);
      }
      expect(total).toBeCloseTo(1);
    }
    let area = 0;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
    for (let i = 0; i < refined.index!.count; i += 3) {
      a.fromBufferAttribute(p, refined.index!.getX(i));
      b.fromBufferAttribute(p, refined.index!.getX(i+1));
      c.fromBufferAttribute(p, refined.index!.getX(i+2));
      area += b.sub(a).cross(c.sub(a)).length() / 2;
    }
    expect(area).toBeCloseTo(1);
    donor.dispose(); refined.dispose();
  });
});
