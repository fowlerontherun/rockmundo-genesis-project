// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, stageLedEdgePositions } from './venueProduction';
import { createStageDeckMaterial, createVenueShowScreenTexture, venueScreenDimensions } from './venueProductionQuality';
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
      venueKind: 'live_house', bandName: 'The Reverbs', width: 1024, height: 448, format: 'wide',
    });
    expect(big.userData.venueShowGraphics).toEqual({
      venueKind: 'stadium', bandName: 'The Reverbs', width: 2048, height: 768, format: 'wide',
    });
    expect(big.colorSpace).toBe(T.SRGBColorSpace);
    expect(big.name).toBe('venue-shared-show-led-stadium-wide');
    small.dispose(); big.dispose();
  });

  it.each([
    ['live_house', 900, 1024, 448],
    ['indoor_arena', 9000, 1024, 384],
    ['stadium', 65000, 2048, 768],
    ['festival_stage', 20000, 2048, 768],
  ] as const)('%s capacity %i displays layout-specific artist graphics', (kind, capacity, width, height) => {
    const p = resolveVenueProfile({ type: kind, capacity });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS');
    const wall = root.getObjectByName('stage-led-wall-display') as T.Mesh;
    const material = wall.material as T.MeshStandardMaterial;
    expect(material.map?.userData.venueShowGraphics).toEqual({
      venueKind: kind, bandName: 'THE SHOCKS', width, height, format: 'wide',
    });
    expect(material.map).toBe(material.emissiveMap);
    if (capacity > 3000) {
      const left = root.getObjectByName('stage-side-screen--1-display') as T.Mesh;
      const right = root.getObjectByName('stage-side-screen-1-display') as T.Mesh;
      const leftMap = (left.material as T.MeshStandardMaterial).map;
      const rightMap = (right.material as T.MeshStandardMaterial).map;
      expect(leftMap).toBe(rightMap);
      expect(leftMap).not.toBe(material.map);
      const sideSize = width === 2048 ? 1536 : 1024;
      expect(leftMap?.userData.venueShowGraphics).toEqual({
        venueKind: kind, bandName: 'THE SHOCKS', width: sideSize, height: sideSize, format: 'square',
      });
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


describe('stage LED image aspect and picture clearance', () => {
  it('sizes wide and square artwork to match the actual screen geometry at each tier', () => {
    const representative = [
      ['live_house', 900, 2],
      ['indoor_arena', 9000, 3],
      ['stadium', 65000, 4],
    ] as const;
    for (const [kind, capacity, tier] of representative) {
      const p = resolveVenueProfile({ type: kind, capacity });
      const wide = venueScreenDimensions(tier);
      const wideDisplayAspect = (p.stageWidth * .7) / ((p.rigHeight - p.stageHeight) * .65);
      expect(Math.abs(wide.width / wide.height / wideDisplayAspect - 1)).toBeLessThan(.08);
      const square = venueScreenDimensions(tier, 'square');
      if (tier >= 3) {
        const sideWidth = tier === 4 ? 7 : 4.6;
        const sideHeight = tier === 4 ? 7.4 : 4.5;
        expect(Math.abs(square.width / square.height / (sideWidth / sideHeight) - 1)).toBeLessThan(.08);
      }
      expect(square.width).toBe(square.height);
    }
    expect(venueScreenDimensions(4)).toEqual({ width: 2048, height: 768, format: 'wide' });
    expect(venueScreenDimensions(4, 'square')).toEqual({ width: 1536, height: 1536, format: 'square' });
  });

  it.each(['live_house', 'indoor_arena', 'stadium'] as const)(
    '%s positions all decorative LED battens beside the screen instead of over its picture', kind => {
      const p = resolveVenueProfile({ type: kind });
      const positions = stageLedEdgePositions(p);
      const activePictureHalfWidth = p.stageWidth * .7 / 2;
      const barHalfWidth = p.stageWidth * .009 / 2;
      expect(positions).toHaveLength(18);
      expect(positions.filter(bar => bar.x < 0)).toHaveLength(9);
      expect(positions.filter(bar => bar.x > 0)).toHaveLength(9);
      for (const bar of positions) {
        expect(Math.abs(bar.x) - barHalfWidth).toBeGreaterThan(activePictureHalfWidth);
        expect(Math.abs(bar.x) + barHalfWidth).toBeLessThan(p.stageWidth / 2);
        expect(bar.height).toBeGreaterThan(0);
        expect(bar.height).toBeLessThan(p.rigHeight - p.stageHeight);
      }
    },
  );

  it('reuses square IMAG art across left and right without allocating a copy for each screen', () => {
    const p = resolveVenueProfile({ type: 'stadium', capacity: 65000 });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'EXTRA LONG BAND NAME');
    const front = root.getObjectByName('stage-led-wall-display') as T.Mesh;
    const left = root.getObjectByName('stage-side-screen--1-display') as T.Mesh;
    const right = root.getObjectByName('stage-side-screen-1-display') as T.Mesh;
    const wide = (front.material as T.MeshStandardMaterial).map;
    const leftMap = (left.material as T.MeshStandardMaterial).map;
    const rightMap = (right.material as T.MeshStandardMaterial).map;
    expect(leftMap).toBe(rightMap);
    expect(leftMap).not.toBe(wide);
    expect(wide?.userData.venueShowGraphics.format).toBe('wide');
    expect(leftMap?.userData.venueShowGraphics.format).toBe('square');
    expect((left.material as T.MeshStandardMaterial).emissiveMap).toBe(leftMap);
    disposeModel(scene);
  });
});
