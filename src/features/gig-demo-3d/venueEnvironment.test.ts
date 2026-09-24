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
        expect(node.count).toBe(0); expect(node.userData.maxCount).toBeGreaterThan(0); expect(node.userData.maxCount).toBeLessThanOrEqual(12000);
        const matrix = new T.Matrix4(); node.getMatrixAt(0, matrix); expect(matrix.elements.every(Number.isFinite)).toBe(true);
      }
    });
    expect(draws).toBeLessThan(45);
    if (p.seating || p.capacity > 3000) expect(root.getObjectByName('venue-distant-audience')).toBeDefined();
    if (['cafe_stage','jazz_lounge','dive_bar','rock_club','live_house','university_union'].includes(p.kind)) {
      const dressing = root.getObjectByName(`venue-dressing-${p.kind}`);
      expect(dressing).toBeDefined();
      expect((dressing?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(4);
    }
    if (['warehouse','theatre','concert_hall','church_hall','street_corner','city_square','rooftop_terrace'].includes(p.kind)) {
      const dressing = root.getObjectByName(`venue-detail-dressing-${p.kind}`);
      expect(dressing).toBeDefined();
      expect((dressing?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(4);
    }
    if (['indoor_arena','ice_arena','stadium','amphitheatre','festival_stage','festival_tent','beach_stage'].includes(p.kind)) {
      const dressing = root.getObjectByName(`venue-large-dressing-${p.kind}`);
      expect(dressing).toBeDefined();
      expect((dressing?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(4);
    }
    if (p.kind !== 'tv_studio') {
      const detail = root.getObjectByName(`venue-microdetail-${p.kind}`);
      expect(detail).toBeDefined();
      expect(detail?.userData.variationSignature).toBeTruthy();
      expect((detail?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(7);
    }
    expect(new T.Box3().setFromObject(root).max.y).toBeLessThanOrEqual(201);
    disposeModel(scene);
  });
});
