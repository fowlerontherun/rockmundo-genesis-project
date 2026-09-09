// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildVenueEnvironment } from './venueEnvironment';
import { resolveVenueProfile, VENUE_TYPES } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

describe('built venue architecture', () => {
  it.each(Object.keys(VENUE_TYPES))('builds bounded, batched geometry for %s with an initially empty audience', type => {
    const p = resolveVenueProfile({ type }), scene = new T.Scene();
    const root = buildVenueEnvironment(scene, p, 123, new T.MeshStandardMaterial(), new T.MeshStandardMaterial());
    expect(root.name).toBe(`environment-${type}`);
    let draws = 0;
    root.traverse(node => {
      if (!(node instanceof T.Mesh)) return;
      draws++;
      const position = node.geometry.attributes.position;
      for (let i = 0; i < position.count; i += 17) expect([position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)).toBe(true);
      if (node instanceof T.InstancedMesh) {
        expect(node.count).toBe(0); expect(node.userData.maxCount).toBeGreaterThan(0); expect(node.userData.maxCount).toBeLessThanOrEqual(1800);
        const matrix = new T.Matrix4(); node.getMatrixAt(0, matrix); expect(matrix.elements.every(Number.isFinite)).toBe(true);
      }
    });
    expect(draws).toBeLessThan(35);
    if (p.seating || p.capacity > 3000) expect(root.getObjectByName('venue-distant-audience')).toBeDefined();
    expect(new T.Box3().setFromObject(root).max.y).toBeLessThanOrEqual(201);
    disposeModel(scene);
  });
});
