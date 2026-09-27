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

  it('clones mapped PBR fallbacks and applies the venue-specific texture scale without double tinting', () => {
    const woodMap = new T.Texture();
    const woodNormal = new T.Texture();
    const woodRough = new T.Texture();
    const woodAo = new T.Texture();
    const wood = new T.MeshStandardMaterial({
      map: woodMap,
      normalMap: woodNormal,
      roughnessMap: woodRough,
      aoMap: woodAo,
      color: '#8b7768',
    });
    const brick = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(resolveVenueProfile({ type: 'cafe_stage' }), wood, brick);

    expect(surfaces.floor.map).not.toBe(woodMap);
    expect(surfaces.floor.normalMap).not.toBe(woodNormal);
    expect(surfaces.floor.roughnessMap).not.toBe(woodRough);
    expect(surfaces.floor.aoMap).not.toBe(woodAo);
    expect(surfaces.floor.map?.repeat.toArray()).toEqual([6, 3]);
    expect(surfaces.floor.normalMap?.repeat.toArray()).toEqual([6, 3]);
    expect(surfaces.floor.color.getHexString()).toBe('ffffff');
    expect(woodMap.repeat.toArray()).toEqual([1, 1]);
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

  it('increases near-camera procedural surface detail with venue scale', () => {
    const wood = new T.MeshStandardMaterial(), brick = new T.MeshStandardMaterial();
    const intimate = buildVenueSurfaceMaterials(resolveVenueProfile({ type: 'street_corner', capacity: 40 }), wood, brick);
    const club = buildVenueSurfaceMaterials(resolveVenueProfile({ type: 'rock_club', capacity: 700 }), wood, brick);
    const stadium = buildVenueSurfaceMaterials(resolveVenueProfile({ type: 'stadium', capacity: 65000 }), wood, brick);
    expect((intimate.floor.map?.image as { width: number }).width).toBe(64);
    expect((club.floor.map?.image as { width: number }).width).toBe(128);
    expect((stadium.floor.map?.image as { width: number }).width).toBe(256);
    expect((stadium.floor.bumpMap?.image as { width: number }).width).toBe(256);
    expect(stadium.floor.map?.repeat.toArray()).toEqual([7, 7]);
  });

});
