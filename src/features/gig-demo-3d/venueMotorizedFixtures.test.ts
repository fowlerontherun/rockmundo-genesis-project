// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { disposeModel } from '@/features/player-model/model';
import { buildVenueProduction, productionLayout, stageBannerLayout, stageLightPositions } from './venueProduction';
import { aimMotorizedHead } from './venueProductionQuality';
import { planVenueLighting, venueBeamCue } from './venueLightShow';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const label = (_text: string, width: number, height: number) =>
  new T.Mesh(new T.PlaneGeometry(width, height), new T.MeshBasicMaterial());

describe('motorized moving-head optics', () => {
  it.each(Object.keys(VENUE_TYPES) as VenueKind[])('%s retains only the active beam heads as independently moving stage objects', kind => {
    const profile = resolveVenueProfile({ type: kind });
    const scene = new T.Scene();
    const root = buildVenueProduction(scene, profile, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'SHOCKMASTER');
    const positions = stageLightPositions(profile);
    const selected = planVenueLighting(profile, positions, productionLayout(profile).tier, 'high').spotlightIndices;
    const heads: T.Group[] = [];
    root.traverse(object => {
      if (object instanceof T.Group && object.userData.motorizedHead) heads.push(object);
    });
    expect(heads).toHaveLength(kind === 'tv_studio' ? 0 : selected.length);

    if (kind !== 'tv_studio') {
      for (const index of selected) {
        const rootFixture = root.getObjectByName('production-light-' + index) as T.Group;
        const head = root.getObjectByName('production-light-' + index + '-head') as T.Group;
        expect(head).toBeDefined();
        expect(head.parent).toBe(rootFixture);
        expect(head.children).toHaveLength(3);
        expect(head.children.every(child => child instanceof T.Mesh && child.userData.animated)).toBe(true);
        expect(rootFixture.position.toArray()).toEqual(positions[index]);
      }
      // Unselected decorative lamps remain eligible for mesh batching.
      if (positions.length > selected.length) {
        const omitted = positions.findIndex((_, i) => !selected.includes(i));
        expect(root.getObjectByName('production-light-' + omitted + '-head')).toBeUndefined();
      }
    }
    disposeModel(scene);
  });

  it('rotates the lamp body, glass and bezel together to its actual spotlight aim', () => {
    const scene = new T.Scene(), profile = resolveVenueProfile({ type: 'stadium', seed: 127 });
    const root = buildVenueProduction(scene, profile, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'SHOCKMASTER');
    const head = root.getObjectByName('production-light-0-head')!;
    const fixture = head.parent!;
    const atZero = venueBeamCue(profile, fixture.position.toArray() as [number, number, number], 0, 0, 1, false);
    const after = venueBeamCue(profile, fixture.position.toArray() as [number, number, number], 0, 52.5, 1, false);
    const original = head.quaternion.clone();
    aimMotorizedHead(head, fixture.position, new T.Vector3(...atZero.target));
    const first = head.quaternion.clone();
    const direction = new T.Vector3(0, -1, 0).applyQuaternion(first).normalize();
    expect(direction.distanceTo(new T.Vector3(...atZero.target).sub(fixture.position).normalize())).toBeLessThan(1e-6);
    aimMotorizedHead(head, fixture.position, new T.Vector3(...after.target));
    expect(head.quaternion.equals(first)).toBe(false);
    aimMotorizedHead(head, fixture.position, new T.Vector3(...atZero.target));
    expect(head.quaternion.toArray()).toEqual(first.toArray());
    expect(original.toArray().every(Number.isFinite)).toBe(true);
    disposeModel(scene);
  });

  it('ignores zero-length or non-finite directions without introducing broken rig transforms', () => {
    const pivot = new T.Group();
    const original = pivot.quaternion.clone();
    aimMotorizedHead(pivot, new T.Vector3(1, 2, 3), new T.Vector3(1, 2, 3));
    aimMotorizedHead(pivot, new T.Vector3(1, 2, 3), new T.Vector3(Number.NaN, 4, 5));
    expect(pivot.quaternion.toArray()).toEqual(original.toArray());
  });
});

describe('independent artist banner clearance', () => {
  it.each(['live_house', 'indoor_arena', 'ice_arena', 'festival_stage', 'stadium'] as const)(
    '%s keeps the band banner above the active rear LED picture', kind => {
      const profile = resolveVenueProfile({ type: kind });
      const scene = new T.Scene();
      const root = buildVenueProduction(scene, profile, new T.MeshStandardMaterial(), new T.MeshStandardMaterial(), label, 'SHOCKMASTER');
      const banner = root.getObjectByName('stage-band-banner') as T.Mesh;
      const wall = root.getObjectByName('stage-led-wall') as T.Group;
      const screenHeight = (profile.rigHeight - profile.stageHeight) * .65;
      const top = wall.position.y + screenHeight / 2;
      const bannerBottom = banner.position.y - banner.userData.bannerHeight / 2;
      expect(banner.userData.screenTop).toBeCloseTo(top);
      expect(bannerBottom).toBeGreaterThan(top);
      expect(banner.position.y + banner.userData.bannerHeight / 2).toBeLessThan(profile.rigHeight);
      expect(stageBannerLayout(profile, true).centerY).toBeCloseTo(banner.position.y);
      disposeModel(scene);
    },
  );

  it('preserves the independent non-LED heritage banner layout', () => {
    const profile = resolveVenueProfile({ type: 'jazz_lounge' });
    const layout = stageBannerLayout(profile, false);
    expect(layout.screenTop).toBeNull();
    expect(layout.centerY).toBeLessThan(profile.rigHeight);
    expect(layout.height).toBeGreaterThan(0);
  });
});
