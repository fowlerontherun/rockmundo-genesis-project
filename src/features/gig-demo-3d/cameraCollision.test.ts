import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CameraCollisionWorld, constrainCamera, safeCameraPose, cameraLensFootprint } from './cameraCollision';
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
  it('finds another side of the subject when every original shot hits a nearby wall', () => {
    const root = new T.Group(); wall(root, [12, 8, .3], [0, 4, .7]);
    const world = new CameraCollisionWorld(root), target = v(0, 2, 0);
    const body = { center: v(0, 1.7, 0), radius: 1.05 };
    const safe = safeCameraPose(world, profile, v(0, 2, 6), target, [body]);
    expect(safe.distanceTo(target)).toBeGreaterThanOrEqual(1.6);
    expect(safe.distanceTo(body.center)).toBeGreaterThanOrEqual(body.radius + .35);
    expect(world.clearDistance(target, safe)).toBeCloseTo(safe.distanceTo(target));
  });
  it('escapes foreground bodies covering all seven original candidate positions', () => {
    const target = v(0, 2, 0), desired = v(0, 2, 5);
    const blockers = [desired, ...[1.3, 2.6].flatMap(rise => [0, -2, 2].map(side => desired.clone().add(v(side, rise, 0))))]
      .map(center => ({ center, radius: .8 }));
    const world = new CameraCollisionWorld();
    const safe = safeCameraPose(world, profile, desired, target, blockers);
    expect(blockers.every(({ center, radius }) => safe.distanceTo(center) >= radius + .35)).toBe(true);
    expect(safeCameraPose(world, profile, desired, target, blockers)).toEqual(safe);
  });
  it('blocks opaque back-face scenery as well as front-face scenery', () => {
    const plane = new T.Mesh(new T.PlaneGeometry(10, 8), new T.MeshBasicMaterial({ side: T.BackSide }));
    plane.position.set(0, 4, 4);
    const world = new CameraCollisionWorld(plane);
    expect(world.clearDistance(v(0, 2, 0), v(0, 2, 7))).toBeCloseTo(4);
  });
  it('ignores triangles outside the rendered geometry draw range', () => {
    const first = new T.PlaneGeometry(10, 8).toNonIndexed(); first.translate(0, 4, 4);
    const second = new T.PlaneGeometry(10, 8).toNonIndexed(); second.translate(0, 4, 6);
    const geometry = mergeGeometries([first, second]);
    geometry.setDrawRange(first.attributes.position.count, second.attributes.position.count);
    const mesh = new T.Mesh(geometry, new T.MeshBasicMaterial());
    expect(new CameraCollisionWorld(mesh).clearDistance(v(0, 2, 0), v(0, 2, 7))).toBeCloseTo(6);
  });

  it('detects thin posts at the middle of a screen edge', () => {
    const root = new T.Group(); wall(root, [.16, .16, .16], [.35, 2, 4]);
    const world = new CameraCollisionWorld(root);
    expect(world.clearDistance(v(0, 2, 0), v(0, 2, 7))).toBeLessThan(4);
  });
  it('protects wider lens footprints without reusing a narrow cached result', () => {
    const root = new T.Group(); wall(root, [.16, .16, .16], [.8, 2, 4]);
    const world = new CameraCollisionWorld(root), target = v(0, 2, 0), lens = v(0, 2, 7);
    expect(world.clearDistance(target, lens)).toBe(7);
    expect(world.clearDistance(target, lens, { halfWidth: .8, halfHeight: .35 })).toBeLessThan(4);
    expect(world.clearDistance(target, lens)).toBe(7);
  });

  it('sizes lens clearance for corrected FOV and ultrawide screens', () => {
    const near = .08, aspect = 6, footprint = cameraLensFootprint(near, aspect);
    const corner = near * Math.tan(100 * Math.PI / 360);
    expect(footprint.halfWidth).toBeGreaterThan(corner * aspect);
    expect(footprint.halfHeight).toBeGreaterThan(corner);
    expect(cameraLensFootprint(near, 1.8)).toEqual({ halfWidth: .35, halfHeight: .35 });
    expect(Object.values(cameraLensFootprint(NaN, Infinity)).every(Number.isFinite)).toBe(true);
    const p = resolveVenueProfile({ type: 'dive_bar' });
    const lens = constrainCamera(v(999, 999, 999), p, footprint);
    expect(p.roomWidth / 2 - lens.x).toBeGreaterThan(footprint.halfWidth);
    expect(p.roofHeight - lens.y).toBeGreaterThan(footprint.halfHeight);
  });

});
