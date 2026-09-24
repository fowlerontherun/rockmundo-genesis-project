// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticMeshes } from './stage';
import { buildVenueMicroDetail } from './venueMicroDetail';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile, VENUE_TYPES } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

const supported = Object.keys(VENUE_TYPES).filter(type => type !== 'tv_studio');

describe('venue microdetail and deterministic variation', () => {
  it.each(supported)('adds lived-in detail to %s without excessive draw cost', type => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const parent = new T.Group();
    scene.add(parent);
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    const detail = buildVenueMicroDetail(parent, profile, 991, surfaces);

    expect(detail?.name).toBe(`venue-microdetail-${type}`);
    expect(detail?.getObjectByName('venue-micro-utilities')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-waste-stations')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-wear')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-safety-markings')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-cable-runs')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-service-point')).toBeDefined();
    expect((detail?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(7);
    expect(detail?.userData.variationSignature).toMatch(new RegExp(`^${type}:\\d:(?:-1|1):\\d:\\d// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticMeshes } from './stage';
import { buildVenueMicroDetail } from './venueMicroDetail';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile, VENUE_TYPES } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

const supported = Object.keys(VENUE_TYPES).filter(type => type !== 'tv_studio');

describe('venue microdetail and deterministic variation', () => {
  it.each(supported)('adds lived-in detail to %s without excessive draw cost', type => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const parent = new T.Group();
    scene.add(parent);
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    const detail = buildVenueMicroDetail(parent, profile, 991, surfaces);

    expect(detail?.name).toBe(`venue-microdetail-${type}`);
    expect(detail?.getObjectByName('venue-micro-utilities')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-waste-stations')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-wear')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-safety-markings')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-cable-runs')).toBeDefined();
    expect(detail?.getObjectByName('venue-micro-service-point')).toBeDefined();
    expect((detail?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(7);
));

    const bounds = new T.Box3().setFromObject(detail!);
    expect([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)).toBe(true);
    expect(bounds.max.y).toBeLessThanOrEqual(profile.roofHeight + .8);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-profile.roomWidth / 2 - .8);
    expect(bounds.max.x).toBeLessThanOrEqual(profile.roomWidth / 2 + .8);

    batchStaticMeshes(detail!);
    let meshDraws = 0;
    detail?.traverse(node => {
      if (node instanceof T.Mesh) meshDraws += 1;
    });
    expect(meshDraws).toBeLessThanOrEqual(12);

    disposeModel(scene);
  });

  it('is stable for the same venue seed and varies across representative seeds', () => {
    const profile = resolveVenueProfile({ type: 'rock_club' });
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    const signatures = [101, 101, 205, 309, 413].map(seed => {
      const parent = new T.Group();
      return buildVenueMicroDetail(parent, profile, seed, surfaces)?.userData.variationSignature;
    });

    expect(signatures[0]).toBe(signatures[1]);
    expect(new Set(signatures).size).toBeGreaterThanOrEqual(3);
    const variants = signatures.map(signature => Number(String(signature).split(':')[1]));
    expect(new Set(variants).size).toBeGreaterThanOrEqual(2);
  });

  it('keeps the television studio on its dedicated production-detail path', () => {
    const profile = resolveVenueProfile({ type: 'tv_studio' });
    const parent = new T.Group();
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    expect(buildVenueMicroDetail(parent, profile, 99, surfaces)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
