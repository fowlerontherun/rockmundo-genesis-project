import { describe, expect, it } from 'vitest';
import * as T from 'three';
import {
  clearHairForHeadAccessories,
  tuckHair,
} from './accessoryGeometry';

function hairRoot(points: number[][]) {
  const root = new T.Group();
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
  const hair = new T.Mesh(geometry, new T.MeshStandardMaterial());
  hair.name = 'avatar-hairstyle';
  root.add(hair);
  root.updateMatrixWorld(true);
  return { root, hair };
}

const bounds = () => new T.Box3(
  new T.Vector3(-.5, 0, -.4),
  new T.Vector3(.5, 1, .4),
);

describe('accessory hair collision fitting', () => {
  it('pushes procedural hair away from glasses temples and earrings without moving unrelated hair', () => {
    const { root, hair } = hairRoot([
      [.46, .64, .25],
      [.48, .44, .04],
      [0, .10, 0],
    ]);
    const before = Array.from(hair.geometry.attributes.position.array as ArrayLike<number>);

    const result = clearHairForHeadAccessories(
      root,
      bounds(),
      {},
      { glasses: true, rightEarring: true },
    );

    const after = hair.geometry.attributes.position;
    expect(after.getX(0)).toBeGreaterThan(before[0]);
    expect(after.getX(1)).toBeGreaterThan(before[3]);
    expect(after.getX(2)).toBeCloseTo(before[6]);
    expect(result.adjustedVertices).toBeGreaterThanOrEqual(2);
    expect(result.glassesVertices).toBeGreaterThan(0);
    expect(result.earringVertices).toBeGreaterThan(0);
    expect(root.userData.rockmundoAccessoryHairClearance).toEqual(result);
  });

  it('tucks crown hair inside hats while retaining long hair beneath the brim', () => {
    const { root, hair } = hairRoot([
      [.49, .92, .20],
      [.49, .79, .20],
      [.44, .55, .20],
    ]);

    tuckHair(root, bounds(), 'masculine');

    const position = hair.geometry.attributes.position;
    expect(position.getY(0)).toBeLessThan(.90);
    expect(Math.abs(position.getX(0))).toBeLessThan(.49);
    expect(position.getY(1)).toBeLessThan(.79);
    expect(position.getY(2)).toBeCloseTo(.55);
    expect(position.getX(2)).toBeCloseTo(.44);
  });
});
