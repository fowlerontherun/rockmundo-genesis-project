import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CameraCollisionWorld, constrainCamera, safeCameraPose } from './cameraCollision';
import { resolveVenueProfile, VENUE_TYPES, type VenueKind } from './venueProfile';

const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const profile = resolveVenueProfile({ type: 'rock_club', capacity: 300 });
function wall(root: T.Group, size: number[], position: number[]) {
  const mesh = new T.Mesh(new T.BoxGeometry(...size as [number, number, number]), new T.MeshBasicMaterial());
  mesh.position.set(...position as [number, number, number]); root.add(mesh); return mesh;
}
describe('gig camera scenery clearance', () => {
  it('moves a lens in front of a wall instead of showing through it', () => {
    const root = new T.Group(); wall(root, [12, 8, .3], [0, 4, 4]);
    const world = new CameraCollisionWorld(root), target = v(0, 2, 0);
    const safe = safeCameraPose(world, profile, v(0, 2, 7), target);
    expect(safe.z).toBeLessThan(3.85);
    expect(world.clearDistance(target, safe)).toBeCloseTo(safe.distanceTo(target));
  });
  it('checks both faces of thin scenery and the near-plane corners', () => {
    const root = new T.Group();
    const plane = new T.Mesh(new T.PlaneGeometry(10, 8), new T.MeshBasicMaterial());
    plane.position.set(0, 4, 4); root.add(plane);
    const world = new CameraCollisionWorld(root);
    expect(world.clearDistance(v(0, 2, 0), v(0, 2, 7))).toBeCloseTo(4);
    expect(world.clearDistance(v(0, 2, 7), v(0, 2, 0))).toBeCloseTo(3);
    const cornerRoot = new T.Group(); wall(cornerRoot, [.2, .2, .2], [.35, 2.35, 4]);
    expect(new CameraCollisionWorld(cornerRoot).clearDistance(v(0, 2, 0), v(0, 2, 7))).toBeLessThan(4);
  });
  it('does not treat a doorway in merged architecture as a solid bounding box', () => {
    const root = new T.Group();
    wall(root, [2, 5, .3], [-2, 2.5, 4]); wall(root, [2, 5, .3], [2, 2.5, 4]);
    wall(root, [6, 1, .3], [0, 5, 4]);
    root.updateMatrixWorld(true);
    const geometry = mergeGeometries(root.children.map(mesh => (mesh as T.Mesh).geometry.clone().applyMatrix4(mesh.matrixWorld)));
    const merged = new T.Mesh(geometry, new T.MeshBasicMaterial());
    expect(new CameraCollisionWorld(merged).clearDistance(v(0, 2, 0), v(0, 2, 7))).toBe(7);
  });
  it('skips transparent effects, sky domes and instanced crowds', () => {
    const root = new T.Group(); const beam = wall(root, [10, 8, .2], [0, 4, 4]);
    beam.material = new T.MeshBasicMaterial({ transparent: true, opacity: .1 });
    const sky = new T.Mesh(new T.SphereGeometry(5), new T.MeshBasicMaterial({ side: T.BackSide })); root.add(sky);
    const crowd = new T.InstancedMesh(new T.BoxGeometry(2, 4, 2), new T.MeshBasicMaterial(), 1); root.add(crowd);
    expect(new CameraCollisionWorld(root).clearDistance(v(0, 2, 0), v(0, 2, 7))).toBe(7);
  });
  it('keeps corrected lenses inside each venue and above its stage deck', () => {
    for (const kind of Object.keys(VENUE_TYPES) as VenueKind[]) {
      const p = resolveVenueProfile({ type: kind });
      const lens = constrainCamera(v(999, 999, -999), p);
      expect(lens.x).toBeLessThan(p.roomWidth / 2);
      expect(lens.z).toBeGreaterThan(.65 - p.stageDepth - 1.4);
      if (!p.outdoor) expect(lens.y).toBeLessThan(p.roofHeight);
      expect(constrainCamera(v(0, -999, -1), p).y).toBeGreaterThan(p.stageHeight);
    }
  });
  it('avoids foreground heads and reconstructs the same correction after a seek', () => {
    const world = new CameraCollisionWorld(), target = v(0, 2, 0), desired = v(0, 2, 5);
    const blockers = [{ center: desired.clone(), radius: .8 }];
    const safe = safeCameraPose(world, profile, desired, target, blockers);
    expect(safe.distanceTo(desired)).toBeGreaterThanOrEqual(1.15);
    safeCameraPose(world, profile, v(3, 4, 7), target);
    expect(safeCameraPose(world, profile, desired, target, blockers)).toEqual(safe);
    expect(desired).toEqual(v(0, 2, 5));
  });
});
