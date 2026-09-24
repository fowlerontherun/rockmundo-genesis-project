// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildVenueDressing } from './venueDressing';
import { buildVenueSurfaceMaterials } from './venueSurfaceMaterials';
import { resolveVenueProfile } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

const venueCases = [
  ['cafe_stage', ['venue-cafe-coffee-bar', 'venue-cafe-window-front', 'venue-cafe-warm-practicals']],
  ['jazz_lounge', ['venue-jazz-banquettes', 'venue-jazz-framed-art', 'venue-jazz-brass-sconces']],
  ['dive_bar', ['venue-dive-back-bar', 'venue-dive-dartboard', 'venue-dive-low-ceiling-beams']],
  ['rock_club', ['venue-rock-front-barrier', 'venue-rock-road-cases', 'venue-rock-acoustic-wall']],
  ['live_house', ['venue-live-house-foh', 'venue-live-house-backstage-door', 'venue-live-house-merch-point']],
  ['university_union', ['venue-union-noticeboards', 'venue-union-stacked-chairs', 'venue-union-vending-area']],
] as const;

describe('small venue identity dressing', () => {
  it.each(venueCases)('gives %s recognisable venue-specific dressing', (type, expectedNames) => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const parent = new T.Group();
    scene.add(parent);
    const base = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, base, base);
    const dressing = buildVenueDressing(parent, profile, 1234, surfaces);

    expect(dressing?.name).toBe(`venue-dressing-${type}`);
    for (const name of expectedNames) expect(dressing?.getObjectByName(name)).toBeDefined();
    expect(dressing?.userData.identityFeatures.length).toBeGreaterThanOrEqual(4);

    const lights: T.PointLight[] = [];
    dressing?.traverse(node => {
      if (node instanceof T.PointLight) lights.push(node);
    });
    expect(lights.length).toBeGreaterThan(0);
    expect(lights.length).toBeLessThanOrEqual(4);
    expect(lights.every(light => !light.castShadow)).toBe(true);

    const bounds = new T.Box3().setFromObject(dressing!);
    expect([bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)).toBe(true);
    expect(bounds.max.y).toBeLessThanOrEqual(profile.roofHeight + .6);
    expect(Math.abs(bounds.min.x)).toBeLessThanOrEqual(profile.roomWidth / 2 + .6);
    expect(Math.abs(bounds.max.x)).toBeLessThanOrEqual(profile.roomWidth / 2 + .6);

    disposeModel(scene);
  });

  it('does not add small-venue dressing to unrelated archetypes', () => {
    const profile = resolveVenueProfile({ type: 'stadium' });
    const parent = new T.Group();
    const base = new T.MeshStandardMaterial();
    const surfaces = buildVenueSurfaceMaterials(profile, base, base);
    expect(buildVenueDressing(parent, profile, 42, surfaces)).toBeNull();
    expect(parent.children).toHaveLength(0);
  });
});
