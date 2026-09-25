import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { buildEllipsoidStrandDetail, scalpStrandRibbonCount } from './hairStrands';

const center = new T.Vector3(0, 1.65, .1);

function ribbon(
  radius: T.Vector3,
  quality: 'high' | 'ultra' | 'cinematic' = 'ultra',
  tilt = 0,
) {
  const result = buildEllipsoidStrandDetail({ center, radius, quality, tilt, seed: 11 });
  expect(result).not.toBeNull();
  return result!;
}

describe('sculpted scalp strand ribbons', () => {
  it('has zero geometry cost for crowd/balanced performers and beard-only avatars', () => {
    const radius = new T.Vector3(.03, .11, .04);
    expect(scalpStrandRibbonCount('crowd')).toBe(0);
    expect(scalpStrandRibbonCount('balanced')).toBe(0);
    expect(buildEllipsoidStrandDetail({ center, radius, quality: 'crowd' })).toBeNull();
    expect(buildEllipsoidStrandDetail({ center, radius, quality: 'balanced' })).toBeNull();
  });

  it('adds progressively finer real geometry at high, ultra and cinematic quality', () => {
    const radius = new T.Vector3(.035, .15, .045);
    const high = ribbon(radius, 'high');
    const ultra = ribbon(radius, 'ultra');
    const cinematic = ribbon(radius, 'cinematic');
    expect(high.userData.rockmundoScalpStrandRibbons).toBe(3);
    expect(ultra.userData.rockmundoScalpStrandRibbons).toBe(5);
    expect(cinematic.userData.rockmundoScalpStrandRibbons).toBe(7);
    expect(high.getAttribute('position').count).toBe(3 * 8 * 6);
    expect(ultra.getAttribute('position').count).toBe(5 * 10 * 6);
    expect(cinematic.getAttribute('position').count).toBe(7 * 12 * 6);
    high.dispose(); ultra.dispose(); cinematic.dispose();
  });

  it.each([
    ['long-hair Y', new T.Vector3(.028, .15, .035), 'y'],
    ['swept-quiff Z', new T.Vector3(.025, .022, .10), 'z'],
    ['side-swept X', new T.Vector3(.13, .022, .030), 'x'],
  ] as const)('%s ribbons stay on the outside of the real clump', (_name, radius, axis) => {
    const geometry = ribbon(radius, 'ultra');
    expect(geometry.userData.rockmundoScalpStrandAxis).toBe(axis);
    const positions = geometry.getAttribute('position') as T.BufferAttribute;
    const uv = geometry.getAttribute('uv') as T.BufferAttribute;
    const normals = geometry.getAttribute('normal') as T.BufferAttribute;
    expect(positions.count).toBe(uv.count);
    expect(positions.count).toBe(normals.count);
    for (let i = 0; i < positions.count; i++) {
      const px = (positions.getX(i) - center.x) / radius.x;
      const py = (positions.getY(i) - center.y) / radius.y;
      const pz = (positions.getZ(i) - center.z) / radius.z;
      const normalizedRadius = px * px + py * py + pz * pz;
      expect(normalizedRadius).toBeGreaterThan(1.002);
      expect(Number.isFinite(normals.getX(i))).toBe(true);
      expect(Number.isFinite(normals.getY(i))).toBe(true);
      expect(Number.isFinite(normals.getZ(i))).toBe(true);
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
      expect(uv.getY(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getY(i)).toBeLessThanOrEqual(1);
    }
    geometry.dispose();
  });

  it('rotates with its sculpted parent clump and produces repeatable output', () => {
    const radius = new T.Vector3(.04, .16, .035);
    const first = ribbon(radius, 'high', .20);
    const same = ribbon(radius, 'high', .20);
    const unrotated = ribbon(radius, 'high', 0);
    const posA = first.getAttribute('position');
    const posB = same.getAttribute('position');
    const posC = unrotated.getAttribute('position');
    expect(Array.from((posA as T.BufferAttribute).array as ArrayLike<number>)).toEqual(
      Array.from((posB as T.BufferAttribute).array as ArrayLike<number>),
    );
    expect(posA.getX(0)).not.toBeCloseTo(posC.getX(0), 6);
    expect(first.boundingSphere?.radius).toBeGreaterThan(0);
    first.dispose(); same.dispose(); unrotated.dispose();
  });

  it('rejects zero, negative and non-finite clump dimensions', () => {
    for (const radius of [
      new T.Vector3(0, .1, .03),
      new T.Vector3(-.02, .1, .03),
      new T.Vector3(NaN, .1, .03),
    ]) {
      expect(buildEllipsoidStrandDetail({ center, radius, quality: 'high' })).toBeNull();
    }
  });
});
