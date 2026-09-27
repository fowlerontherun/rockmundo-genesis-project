// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, productionLayout } from './venueProduction';
import { createVenueShowScreenTexture, venueScreenDimensions } from './venueProductionQuality';
import { resolveVenueShowPlan, venueScreenSuspension } from './venueShowIdentity';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = () => new T.Mesh(new T.PlaneGeometry(1, .3), new T.MeshBasicMaterial());

describe('real-sized touring video column artwork', () => {
  it.each([3, 4])('tier %i produces a portrait graphic with the same aspect ratio as its 3D video totem', tier => {
    const dims = venueScreenDimensions(tier, 'portrait');
    const height = tier === 4 ? 4.3 : 2.85;
    expect(dims.width).toBe(256);
    expect(dims.height).toBe(tier === 4 ? 1408 : 928);
    expect(Math.abs((dims.width / dims.height) / (.78 / height) - 1)).toBeLessThan(.03);
  });

  it.each([
    ['indoor_arena', 9000, 1],
    ['ice_arena', 10000, 1],
    ['amphitheatre', 12000, 1],
    ['stadium', 65000, 2],
    ['festival_stage', 20000, 2],
    ['festival_tent', 5000, 1],
  ] as const)('%s builds %i matching portrait LED columns for the named artist', (kind, capacity, perWing) => {
    const p = resolveVenueProfile({ type: kind, capacity, seed: 47 });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'THE SHOCKS');
    const columnGroup = root.getObjectByName('venue-video-totems');
    expect(columnGroup?.userData).toMatchObject({ count: 2 * perWing, graphicsFormat: 'portrait' });
    const textures = [];
    for (const side of [-1, 1]) for (let index = 0; index < perWing; index++) {
      const column = root.getObjectByName('venue-video-totem-display-' + side + '-' + index) as T.Mesh;
      expect(column).toBeDefined();
      const mat = column.material as T.MeshStandardMaterial;
      expect(mat.map).toBe(mat.emissiveMap);
      expect(mat.map?.name).toBe('venue-shared-show-led-' + kind + '-portrait');
      expect(mat.map?.userData.venueShowGraphics).toEqual({
        venueKind: kind, bandName: 'THE SHOCKS', width: 256,
        height: capacity > 15000 ? 1408 : 928, format: 'portrait',
      });
      textures.push(mat.map);
    }
    // One uploaded texture, not one huge 2K artwork for each of four columns.
    expect(new Set(textures).size).toBe(1);
    const main = root.getObjectByName('stage-led-wall-display') as T.Mesh | undefined;
    if (main) expect(textures[0]).not.toBe((main.material as T.MeshStandardMaterial).map);
    const wing = root.getObjectByName('stage-side-screen-1-display') as T.Mesh;
    expect(textures[0]).not.toBe((wing.material as T.MeshStandardMaterial).map);
    disposeModel(scene);
  });

  it('keeps regular clubs, intimate venues and the authored television set free of touring columns', () => {
    for (const kind of ['dive_bar', 'live_house', 'tv_studio', 'jazz_lounge'] as const) {
      const p = resolveVenueProfile({ type: kind });
      const tier = productionLayout(p).tier;
      expect(resolveVenueShowPlan(p, tier).wingVideoTotems).toBe(0);
      const scene = new T.Scene();
      const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'BAND');
      expect(root.getObjectByName('venue-video-totem-display-1-0')).toBeUndefined();
      disposeModel(scene);
    }
  });

  it('retains the band name, seed and bounded size in a portrait-only generated texture', () => {
    const p = resolveVenueProfile({ type: 'stadium', seed: 314 });
    const graphic = createVenueShowScreenTexture(p, 'LONG EXAMPLE BAND', 4, 'portrait');
    expect(graphic.userData.venueShowGraphics).toEqual({
      venueKind: 'stadium', bandName: 'LONG EXAMPLE BAND',
      width: 256, height: 1408, format: 'portrait',
    });
    expect(graphic.colorSpace).toBe(T.SRGBColorSpace);
    expect(graphic.wrapS).toBe(T.ClampToEdgeWrapping);
    expect(graphic.wrapT).toBe(T.ClampToEdgeWrapping);
    graphic.dispose();
  });
});

describe('touring IMAG hangers', () => {
  it.each([
    ['rock_club', 5000],
    ['city_square', 4500],
    ['indoor_arena', 9000],
    ['ice_arena', 10000],
    ['festival_tent', 5000],
    ['stadium', 65000],
    ['festival_stage', 20000],
  ] as const)('%s at capacity %i suspends both real wing screens from their outer frame corners', (kind, capacity) => {
    const p = resolveVenueProfile({ type: kind, capacity });
    const layout = productionLayout(p);
    const suspension = venueScreenSuspension(p, layout.tier)!;
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, p, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'BAND');
    const rigging = root.getObjectByName('venue-screen-support-rigging') as T.Group;
    expect(rigging?.userData).toMatchObject({
      supportedScreens: 2, screenWidth: suspension.screenWidth,
      mountOffset: suspension.mountOffset,
      anchorY: suspension.anchorY,
    });
    expect(suspension.anchorY).toBeGreaterThan(suspension.screenTop + .2);
    for (const side of [-1, 1]) {
      const screen = root.getObjectByName('stage-side-screen-' + side) as T.Group;
      const support = root.getObjectByName('venue-side-screen-suspension-' + side) as T.Group;
      expect(screen).toBeDefined();
      expect(support?.userData.mounts).toHaveLength(2);
      const expectedX = side * (p.stageWidth / 2 + 3.2);
      const mounts = support.userData.mounts as number[][];
      expect(mounts[0]).toEqual([expectedX - suspension.mountOffset, suspension.screenTop, suspension.cableZ]);
      expect(mounts[1]).toEqual([expectedX + suspension.mountOffset, suspension.screenTop, suspension.cableZ]);
      expect(suspension.mountOffset).toBeGreaterThan(suspension.screenWidth * .35);
      expect(suspension.cableZ).toBeLessThan(screen.position.z - .15);
      // The screen's anonymous outer frame is static-batched into the venue.
      // Its named pixel display remains beneath the frame's 12 cm top border.
      const display = root.getObjectByName('stage-side-screen-' + side + '-display') as T.Mesh;
      const displayBounds = new T.Box3().setFromObject(display);
      expect(displayBounds.max.y).toBeCloseTo(suspension.screenTop - .12, 2);
      expect(suspension.screenTop - displayBounds.max.y).toBeCloseTo(.12, 2);
      expect(displayBounds.max.y).toBeLessThan(suspension.anchorY);
      expect(screen.position.z).toBeCloseTo(suspension.screenZ);
    }
    disposeModel(scene);
  });

  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s allocates support rigging exactly when its stage has touring wings', kind => {
    const p = resolveVenueProfile({ type: kind });
    const tier = productionLayout(p).tier;
    const geometry = venueScreenSuspension(p, tier);
    const expected = tier >= 3;
    expect(geometry !== null).toBe(expected);
    if (geometry) {
      expect(Object.values(geometry).every(Number.isFinite)).toBe(true);
      expect(geometry.screenWidth).toBeGreaterThan(0);
      expect(geometry.screenHeight).toBeGreaterThan(0);
      expect(geometry.screenTop).toBeLessThan(geometry.anchorY);
    }
  });
});
