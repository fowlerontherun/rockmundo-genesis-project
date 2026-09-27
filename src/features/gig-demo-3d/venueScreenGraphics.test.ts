// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction } from './venueProduction';
import { createStageDeckMaterial, createVenueShowScreenTexture } from './venueProductionQuality';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

describe('venue stage floor fidelity', () => {
  const timber = new Set(['cafe_stage', 'jazz_lounge', 'church_hall', 'concert_hall', 'theatre', 'park_bandstand']);
  const concrete = new Set(['street_corner', 'city_square', 'warehouse']);
  const metal = new Set(['indoor_arena', 'ice_arena', 'stadium', 'festival_stage', 'live_house']);

  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s has a metre-tiled colour map with separate relief detail', kind => {
    const p = resolveVenueProfile({ type: kind });
    const mat = createStageDeckMaterial(p, new T.MeshStandardMaterial()) as T.MeshStandardMaterial;
    const treatment = timber.has(kind) ? 'timber' : concrete.has(kind) ? 'concrete' : metal.has(kind) ? 'metal' : 'rubber';
    expect(mat.name).toBe('venue-stage-floor-' + treatment);
    expect(mat.userData.venueSurfaceRole).toBe('stage-deck');
    expect(mat.userData.venueFloorTreatment).toBe(treatment);
    expect(mat.map?.wrapS).toBe(T.RepeatWrapping);
    expect(mat.map?.repeat.x).toBeCloseTo(p.stageWidth / 2.4);
    expect(mat.map?.repeat.y).toBeCloseTo(p.stageDepth / 2.4);
    expect(mat.map?.colorSpace).toBe(T.SRGBColorSpace);
    expect(mat.bumpMap?.colorSpace).toBe(T.NoColorSpace);
    expect(mat.map).not.toBe(mat.bumpMap);
    mat.map?.dispose(); mat.bumpMap?.dispose(); mat.dispose();
  });

  it('tiles the actual historic timber stage rather than stretching the default oak', () => {
    const fallback = new T.MeshStandardMaterial();
    const club = createStageDeckMaterial(resolveVenueProfile({ type: 'cafe_stage' }), fallback) as T.MeshStandardMaterial;
    const hall = createStageDeckMaterial(resolveVenueProfile({ type: 'concert_hall', capacity: 2500 }), fallback) as T.MeshStandardMaterial;
    expect(club).not.toBe(fallback);
    expect(hall.map?.repeat.x).toBeGreaterThan(club.map?.repeat.x);
    expect(hall.roughness).toBeLessThan(club.roughness);
  });
});

describe('shared high-resolution artist LED graphics', () => {
  it('scales LED texture resolution by production tier and preserves replay metadata', () => {
    const club = resolveVenueProfile({ type: 'live_house', seed: 314 });
    const stadium = resolveVenueProfile({ type: 'stadium', seed: 314 });
    const small = createVenueShowScreenTexture(club, 'The Reverbs', 2);
    const big = createVenueShowScreenTexture(stadium, 'The Reverbs', 4);
    expect(small.userData.venueShowGraphics).toEqual({
      venueKind: 'live_house', bandName: 'The Reverbs', width: 1024, height: 512,
    });
    expect(big.userData.venueShowGraphics).toEqual({
      venueKind: 'stadium', bandName: 'The Reverbs', width: 2048, height: 1024,
    });
    expect(big.colorSpace).toBe(T.SRGBColorSpace);
    expect(big.name).toBe('venue-shared-show-led-stadium');
    small.dispose(); big.dispose();
  });

  it.each([
    ['live_house', 900, 1024],
    ['indoor_arena', 9000, 1024],
    ['stadium', 65000, 2048],
    ['festival_stage', 20000, 2048],
  ] as const)('%s capacity %i displays a single artist graphic at resolution %i', (kind, capacity, width) => {
    const p = resolveVenueProfile({ type: kind, capacity });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS');
    const wall = root.getObjectByName('stage-led-wall-display') as T.Mesh;
    const material = wall.material as T.MeshStandardMaterial;
    expect(material.map?.userData.venueShowGraphics).toEqual({
      venueKind: kind, bandName: 'THE SHOCKS', width, height: width / 2,
    });
    expect(material.map).toBe(material.emissiveMap);
    if (capacity > 3000) {
      const left = root.getObjectByName('stage-side-screen--1-display') as T.Mesh;
      const right = root.getObjectByName('stage-side-screen-1-display') as T.Mesh;
      expect((left.material as T.MeshStandardMaterial).map).toBe(material.map);
      expect((right.material as T.MeshStandardMaterial).map).toBe(material.map);
    }
    disposeModel(scene);
  });

  it('preserves an unchanged compact band identity for empty and overly long names', () => {
    const p = resolveVenueProfile({ type: 'stadium' });
    const empty = createVenueShowScreenTexture(p, '  ', 4);
    const long = createVenueShowScreenTexture(p, 'x'.repeat(95), 4);
    expect(empty.userData.venueShowGraphics.bandName).toBe('ROCKMUNDO');
    expect(long.userData.venueShowGraphics.bandName).toHaveLength(64);
    expect(long.userData.venueShowGraphics.bandName).toBe('x'.repeat(64));
    empty.dispose(); long.dispose();
  });
});
