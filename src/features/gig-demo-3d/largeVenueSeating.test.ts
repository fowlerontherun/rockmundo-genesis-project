// @vitest-environment node
import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { buildVenueEnvironment } from './venueEnvironment';
import { audienceFloorPlaces } from './venueAudience';
import { resolveVenueProfile } from './venueProfile';
import { disposeModel } from '@/features/player-model/model';

describe('seated audience alignment', () => {
  it.each(['indoor_arena', 'ice_arena', 'stadium'])('%s anchors every seated fan to an inward-facing chair without scale or jitter', type => {
    const profile = resolveVenueProfile({ type });
    const scene = new T.Scene();
    const root = buildVenueEnvironment(scene, profile, 123, new T.MeshStandardMaterial(), new T.MeshStandardMaterial());
    const seats = new Map<string, T.Object3D>();
    const key = (v: T.Vector3) => v.toArray().map(n => n.toFixed(3)).join(',');
    root.traverse(node => { if (node.name === 'venue-seat') seats.set(key(node.position), node); });
    let count = 0;
    root.traverse(node => {
      if (!(node instanceof T.InstancedMesh) || !/audience-humans-[4-7]-/.test(node.name)) return;
      for (let i = 0; i < node.userData.maxCount; i++) {
        const matrix = new T.Matrix4(); node.getMatrixAt(i, matrix);
        const position = new T.Vector3(), rotation = new T.Quaternion(), scale = new T.Vector3();
        matrix.decompose(position, rotation, scale);
        const chair = seats.get(key(position));
        expect(chair).toBeDefined();
        expect(scale.distanceTo(new T.Vector3(1, 1, 1))).toBeLessThan(.00001);
        const forward = new T.Vector3(0, 0, 1).applyQuaternion(rotation);
        const seatForward = new T.Vector3(0, 0, 1).applyQuaternion(chair!.quaternion);
        expect(forward.distanceTo(seatForward)).toBeLessThan(.00001);
        if (Math.abs(position.x) > profile.crowdWidth / 2 + 1) expect(forward.x * position.x).toBeLessThan(0);
        else expect(forward.z).toBeLessThan(-.99);
        // Fixed .44m cushion height matches the underside of the seated hip.
        expect(position.y + .52 - .08).toBeCloseTo(chair!.position.y + .44, 5);
        count++;
      }
    });
    expect(count).toBeGreaterThan(100);
    disposeModel(scene);
  });

  it('does not populate the amphitheatre stone tiers with a second standing crowd', () => {
    const p = resolveVenueProfile({ type: 'amphitheatre' });
    for (const [x, , z] of audienceFloorPlaces(p)) expect(Math.hypot(x, z - 2)).toBeLessThan(p.crowdDepth * .45 - .85);
  });
});
