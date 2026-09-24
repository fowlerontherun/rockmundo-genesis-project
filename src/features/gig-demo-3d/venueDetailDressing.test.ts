// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticMeshes } from './stage';
import { buildVenueDetailDressing } from './venueDetailDressing';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

const cases = [
  ['warehouse', ['venue-warehouse-loading-bay', 'venue-warehouse-service-gantry', 'venue-warehouse-overhead-ducting']],
  ['theatre', ['venue-theatre-private-boxes', 'venue-theatre-side-drapes', 'venue-theatre-orchestra-pit']],
  ['concert_hall', ['venue-concert-acoustic-fins', 'venue-concert-acoustic-clouds', 'venue-concert-balcony-front']],
  ['church_hall', ['venue-church-hall-benches', 'venue-church-hall-honours-board', 'venue-church-hall-serving-hatch']],
  ['street_corner', ['venue-street-bollards', 'venue-street-utilities', 'venue-street-bike-rack']],
  ['city_square', ['venue-square-benches', 'venue-square-planters', 'venue-square-kiosks']],
  ['rooftop_terrace', ['venue-rooftop-hvac', 'venue-rooftop-lounge', 'venue-rooftop-string-lights']],
] as const;

describe('medium and urban venue detail dressing', () => {
  it.each(cases)('gives %s venue-specific architectural dressing', (type, names) => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const parent = new T.Group();
    scene.add(parent);
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    const dressing = buildVenueDetailDressing(parent, profile, 812, surfaces);

    expect(dressing?.name).toBe(`venue-detail-dressing-${type}`);
    for (const name of names) expect(dressing?.getObjectByName(name)).toBeDefined();
    expect((dressing?.userData.identityFeatures ?? []).length).toBeGreaterThanOrEqual(4);

    const lights: T.PointLight[] = [];
    dressing?.traverse(node => {
      if (node instanceof T.PointLight) lights.push(node);
    });
    expect(lights.length).toBeLessThanOrEqual(4);
    expect(lights.every(light => !light.castShadow)).toBe(true);

    const bounds = new T.Box3().setFromObject(dressing!);
    expect([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)).toBe(true);
    expect(bounds.max.y).toBeLessThanOrEqual(profile.roofHeight + 1.2);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-profile.roomWidth / 2 - .9);
    expect(bounds.max.x).toBeLessThanOrEqual(profile.roomWidth / 2 + .9);

    batchStaticMeshes(dressing!);
    let meshDraws = 0;
    dressing?.traverse(node => {
      if (node instanceof T.Mesh) meshDraws += 1;
    });
    expect(meshDraws).toBeLessThanOrEqual(18);

    disposeModel(scene);
  });

  it('leaves unrelated venue archetypes untouched', () => {
    const profile = resolveVenueProfile({ type: 'indoor_arena' });
    const parent = new T.Group();
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    expect(buildVenueDetailDressing(parent, profile, 99, surfaces)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
