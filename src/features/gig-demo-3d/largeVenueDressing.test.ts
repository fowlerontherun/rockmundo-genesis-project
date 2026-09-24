// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { batchStaticMeshes } from './stage';
import { buildLargeVenueDressing } from './largeVenueDressing';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

const cases = [
  ['indoor_arena', ['venue-arena-concourse-portals', 'venue-arena-ribbon-board', 'venue-arena-video-cube']],
  ['ice_arena', ['venue-ice-arena-team-tunnels', 'venue-ice-arena-board-details', 'venue-ice-arena-concourse']],
  ['stadium', ['venue-stadium-access-tunnels', 'venue-stadium-hospitality-ring', 'venue-stadium-end-screens']],
  ['amphitheatre', ['venue-amphitheatre-stone-arches', 'venue-amphitheatre-aisles', 'venue-amphitheatre-tech-platform']],
  ['festival_stage', ['venue-festival-delay-towers', 'venue-festival-backstage-compound', 'venue-festival-village']],
  ['festival_tent', ['venue-festival-tent-ballast', 'venue-festival-tent-side-exits', 'venue-festival-tent-bar']],
  ['beach_stage', ['venue-beach-boardwalk', 'venue-beach-production-tower', 'venue-beach-bar']],
] as const;

describe('large venue identity dressing', () => {
  it.each(cases)('gives %s large-event infrastructure', (type, names) => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const parent = new T.Group();
    scene.add(parent);
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    const dressing = buildLargeVenueDressing(parent, profile, surfaces);

    expect(dressing?.name).toBe(`venue-large-dressing-${type}`);
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
    expect(bounds.max.y).toBeLessThanOrEqual(profile.roofHeight + 1.5);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-profile.roomWidth / 2 - 12);
    expect(bounds.max.x).toBeLessThanOrEqual(profile.roomWidth / 2 + 12);

    batchStaticMeshes(dressing!);
    let meshDraws = 0;
    dressing?.traverse(node => {
      if (node instanceof T.Mesh) meshDraws += 1;
    });
    expect(meshDraws).toBeLessThanOrEqual(20);

    disposeModel(scene);
  });

  it('does not add large-event dressing to small venues', () => {
    const profile = resolveVenueProfile({ type: 'rock_club' });
    const parent = new T.Group();
    const fallback = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, fallback, fallback);
    expect(buildLargeVenueDressing(parent, profile, surfaces)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
