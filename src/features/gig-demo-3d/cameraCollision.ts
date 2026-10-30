import * as T from 'three';
import type { VenueProfile } from './venueProfile';

const CLEARANCE = .35;
export interface LensFootprint { halfWidth: number; halfHeight: number }
const DEFAULT_LENS: Readonly<LensFootprint> = { halfWidth: CLEARANCE, halfHeight: CLEARANCE };

/** Use the largest possible corrected FOV, so widening a wall-constrained shot
 * cannot expose an unchecked near-plane edge. A small pad covers numerical drift. */
export function cameraLensFootprint(near: number, aspect: number, maxFov = 100): LensFootprint {
  const safeNear = Number.isFinite(near) && near > 0 ? near : .08;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const fov = Number.isFinite(maxFov) ? T.MathUtils.clamp(maxFov, 1, 120) : 100;
  const halfHeight = safeNear * Math.tan(fov * Math.PI / 360);
  return { halfWidth: Math.max(CLEARANCE, halfHeight * safeAspect + .05), halfHeight: Math.max(CLEARANCE, halfHeight + .05) };
}
export interface CameraBlocker { center: T.Vector3; radius: number }
interface TriangleEntry { triangle: T.Triangle; bounds: T.Box3; center: T.Vector3 }
interface CollisionNode { bounds: T.Box3; triangles?: T.Triangle[]; left?: CollisionNode; right?: CollisionNode }

function buildTree(entries: TriangleEntry[]): CollisionNode {
  const bounds = new T.Box3();
  for (const entry of entries) bounds.union(entry.bounds);
  if (entries.length <= 12) return { bounds, triangles: entries.map(entry => entry.triangle) };
  const size = bounds.getSize(new T.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
  entries.sort((a, b) => a.center[axis] - b.center[axis]);
  const middle = Math.floor(entries.length / 2);
  return { bounds, left: buildTree(entries.slice(0, middle)), right: buildTree(entries.slice(middle)) };
}

/** Cache a spatial tree of actual opaque scenery triangles before performers load.
 * Doorways and theatre arches remain open; no material or mesh is changed. */
export class CameraCollisionWorld {
  private tree: CollisionNode | null = null;
  private distances = new Map<string, number>();
  constructor(root?: T.Object3D) {
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const entries: TriangleEntry[] = [];
    root.traverse(object => {
      if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh || object instanceof T.SkinnedMesh) return;
      for (let ancestor: T.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
        if (!ancestor.visible || ancestor.userData.animated || ancestor.userData.motorizedHead) return;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const solid = (m: T.Material) => m.visible && !m.transparent;
      // BackSide is also used by opaque walls. Exclude background domes by
      // geometry, rather than dropping every surface rendered from its back.
      if (object.geometry.type === 'SphereGeometry' && materials.every(m => m.side === T.BackSide)) return;
      if (!materials.some(solid)) return;
      const positions = object.geometry.attributes.position, index = object.geometry.index;
      const count = index?.count ?? positions.count;
      const start = Math.max(0, object.geometry.drawRange.start);
      const end = Math.min(count, start + object.geometry.drawRange.count);
      for (let i = start; i + 2 < end; i += 3) {
        const group = object.geometry.groups.find(g => i >= g.start && i < g.start + g.count);
        if (!solid(materials[group?.materialIndex ?? 0] ?? materials[0])) continue;
        const points = [0, 1, 2].map(offset => new T.Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).applyMatrix4(object.matrixWorld));
        const triangle = new T.Triangle(points[0], points[1], points[2]);
        entries.push({ triangle, bounds: new T.Box3().setFromPoints(points), center: triangle.getMidpoint(new T.Vector3()) });
      }
    });
    if (entries.length) this.tree = buildTree(entries);
  }
  private hitDistance(origin: T.Vector3, direction: T.Vector3, distance: number) {
    const ray = new T.Ray(origin, direction), point = new T.Vector3();
    let nearest = distance;
    const visit = (node: CollisionNode) => {
      if (!ray.intersectBox(node.bounds, point) || (!node.bounds.containsPoint(origin) && point.distanceTo(origin) > nearest)) return;
      if (node.triangles) for (const triangle of node.triangles) {
        // Both faces of thin scenery block the lens.
        if (!ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, point)) continue;
        const hit = point.distanceTo(origin);
        if (hit > .05 && hit < nearest) nearest = hit;
      }
      if (node.left) visit(node.left);
      if (node.right) visit(node.right);
    };
    if (this.tree) visit(this.tree);
    return nearest;
  }
  clearDistance(target: T.Vector3, lens: T.Vector3, footprint: Readonly<LensFootprint> = DEFAULT_LENS) {
    const key = [...target.toArray(), ...lens.toArray(), footprint.halfWidth, footprint.halfHeight].join(':');
    const cached = this.distances.get(key);
    if (cached !== undefined) return cached;
    const delta = lens.clone().sub(target), distance = delta.length();
    if (distance < .001) return 0;
    const forward = delta.divideScalar(distance);
    const right = new T.Vector3().crossVectors(forward, new T.Vector3(0, 1, 0));
    if (right.lengthSq() < .001) right.set(1, 0, 0); else right.normalize();
    const up = new T.Vector3().crossVectors(right, forward).normalize();
    let clear = distance;
    for (const [x, y] of [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const offset = right.clone().multiplyScalar(x * footprint.halfWidth).addScaledVector(up, y * footprint.halfHeight);
      clear = Math.min(clear, this.hitDistance(target.clone().add(offset), forward, distance));
    }
    if (this.distances.size >= 128) this.distances.clear();
    this.distances.set(key, clear);
    return clear;
  }
}

export function constrainCamera(position: T.Vector3, p: VenueProfile, footprint: Readonly<LensFootprint> = DEFAULT_LENS): T.Vector3 {
  const margin = Math.min(Math.max(.6, Math.hypot(footprint.halfWidth, footprint.halfHeight) + .1),
    p.roomWidth / 4, p.roomDepth / 4, p.roofHeight / 4);
  position.x = T.MathUtils.clamp(position.x, -p.roomWidth / 2 + margin, p.roomWidth / 2 - margin);
  position.z = T.MathUtils.clamp(position.z, .65 - p.stageDepth - 1.4 + margin, p.roomDepth - margin);
  const deck = Math.abs(position.x) < p.stageWidth / 2 + margin && position.z < .65 + margin;
  position.y = Math.max(deck ? p.stageHeight + margin : margin, position.y);
  if (!p.outdoor) position.y = Math.min(position.y, p.roofHeight - margin);
  return position;
}

/** Deterministic choice from the requested shot and a few nearby alternatives.
 * There is no last-good-camera state, so a seek reconstructs the same correction. */
export function safeCameraPose(world: CameraCollisionWorld, p: VenueProfile, desired: T.Vector3, target: T.Vector3,
  blockers: readonly CameraBlocker[] = [], footprint: Readonly<LensFootprint> = DEFAULT_LENS) {
  const lensRadius = Math.hypot(footprint.halfWidth, footprint.halfHeight);
  const requested = constrainCamera(desired.clone(), p, footprint);
  const candidates = [requested, ...[1.3, 2.6].flatMap(rise => [0, -2, 2].map(side =>
    constrainCamera(requested.clone().add(new T.Vector3(side, rise, 0)), p, footprint)))];
  const candidatesClear = (point: T.Vector3) => blockers.every(({ center, radius }) => {
    // Keep the lens out of bodies/gear, and keep nearby bystanders out of the
    // centre sightline. The subject itself is intentionally at the ray origin.
    if (point.distanceTo(center) < radius + lensRadius) return false;
    const line = new T.Line3(target, point), nearest = line.closestPointToPoint(center, true, new T.Vector3());
    return center.distanceTo(target) < radius + .25 || center.distanceTo(point) > 3 || nearest.distanceTo(center) > radius;
  });
  let best = requested, bestScore = -Infinity, foundUsable = false;
  const evaluate = (candidate: T.Vector3) => {
    const distance = candidate.distanceTo(target);
    const clear = world.clearDistance(target, candidate, footprint);
    const corrected = clear < distance - .001
      ? target.clone().lerp(candidate, Math.max(0, clear - lensRadius) / Math.max(.001, distance)) : candidate;
    constrainCamera(corrected, p, footprint);
    const correctedDistance = corrected.distanceTo(target);
    const sceneryClear = world.clearDistance(target, corrected, footprint) >= correctedDistance - .001;
    const bodiesClear = candidatesClear(corrected);
    const usefulDistance = correctedDistance >= 1.6;
    const usable = sceneryClear && bodiesClear && usefulDistance;
    foundUsable ||= usable;
    // Scenery and body clearance outrank preserving the requested angle. A
    // 20cm wall correction inside the singer is never a usable close-up.
    const score = (sceneryClear ? 10000 : 0) + (bodiesClear ? 1000 : 0) + (usefulDistance ? 100 : 0)
      + Math.min(correctedDistance, 2) * 20 - corrected.distanceTo(desired);
    if (score > bestScore) { best = corrected; bestScore = score; }
    return usable && corrected.distanceTo(candidate) < .001;
  };
  for (const candidate of candidates) {
    if (evaluate(candidate) && candidate === requested) break;
  }
  if (!foundUsable) {
    // A curtain, speaker bank or cluster of foreground bodies may block every
    // local correction. Search other sides of the subject only in that case.
    // Absolute angles and fixed order preserve replay/seek determinism.
    const yaw = Math.atan2(requested.x - target.x, requested.z - target.z);
    const radius = T.MathUtils.clamp(requested.distanceTo(target), 3, 8);
    for (const rise of [0, 2]) for (const turn of [1, -1, 2, -2, 3, -3, 4]) {
      const angle = yaw + turn * Math.PI / 4;
      evaluate(constrainCamera(new T.Vector3(target.x + Math.sin(angle) * radius,
        Math.max(requested.y, target.y + rise), target.z + Math.cos(angle) * radius), p, footprint));
    }
  }
  return best;
}
