// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile, VENUE_TYPES } from './venueProfile';

describe('venue surface materials', () => {
  it.each(Object.keys(VENUE_TYPES))('builds deterministic textured surfaces for %s', type => {
    const profile = resolveVenueProfile({ type });
    const wood = new T.MeshStandardMaterial();
    const brick = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, wood, brick);

    for (const [role, material] of Object.entries(surfaces)) {
      expect(material).toBeInstanceOf(T.MeshStandardMaterial);
      expect(material.name).toContain(`venue-${type}-`);
      expect(material.userData.venueKind).toBe(type);
      expect(material.userData.venueSurfaceRole).toBe(role);
      expect(material.userData.venueSurfacePattern).toBeTruthy();
      expect(material.map).toBeDefined();
      expect(material.normalMap || material.bumpMap).toBeTruthy();
    }
  });

  it('gives representative venue families visibly different floor and wall treatments', () => {
    const wood = new T.MeshStandardMaterial();
    const brick = new T.MeshStandardMaterial();
    const signature = (type: string) => {
      const surfaces = buildVenueSurfaceMaterials(resolveVenueProfile({ type }), wood, brick);
      return [
        surfaces.floor.userData.venueSurfacePattern,
        surfaces.wall.userData.venueSurfacePattern,
        surfaces.detail.userData.venueSurfacePattern,
      ].join(':');
    };

    expect(new Set([
      signature('cafe_stage'),
      signature('jazz_lounge'),
      signature('warehouse'),
      signature('theatre'),
      signature('indoor_arena'),
      signature('city_square'),
      signature('festival_tent'),
      signature('beach_stage'),
    ]).size).toBeGreaterThanOrEqual(7);
  });
});
