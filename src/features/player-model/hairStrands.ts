import * as T from 'three';
import type { AvatarVisualQuality } from './avatarVisualQuality';

/**
 * Add small, real surface ribbons to the existing volumetric hairstyle clumps.
 * Their UVs run along the fibre direction, so the close-up anisotropic material
 * has actual geometry to catch light instead of only a painted normal map.
 *
 * All coordinates match the ellipsoid builder in hair.ts: scale in local space,
 * rotate around Z, then translate to the rest-pose world-space centre.
 * Ribbons sit just outside their parent clump and are merged into the existing
 * Hair draw call. There are deliberately no strands at crowd/balanced quality.
 */
export function scalpStrandRibbonCount(quality: AvatarVisualQuality) {
  if (quality === 'cinematic') return 7;
  if (quality === 'ultra') return 5;
  if (quality === 'high') return 3;
  return 0;
}

export interface EllipsoidStrandDetail {
  center: T.Vector3;
  radius: T.Vector3;
  tilt?: number;
  seed?: number;
  quality: AvatarVisualQuality;
}

/** Returns unindexed, double-sided-ready triangles with longitudinal UVs. */
export function buildEllipsoidStrandDetail({
  center,
  radius,
  tilt = 0,
  seed = 0,
  quality,
}: EllipsoidStrandDetail): T.BufferGeometry | null {
  const count = scalpStrandRibbonCount(quality);
  if (!count) return null;
  const { x: rx, y: ry, z: rz } = radius;
  if (![rx, ry, rz].every(value => Number.isFinite(value) && value > 0)) return null;

  // Long hair follows Y; quiffs and swept-back cuts follow their dominant
  // horizontal axis. These are surface clumps, not free-floating flyaways.
  const axis = ry >= Math.max(rx, rz) ? 'y' : rz >= rx ? 'z' : 'x';
  const minor = axis === 'y' ? Math.min(rx, rz) : axis === 'z' ? Math.min(rx, ry) : Math.min(ry, rz);
  const width = Math.min(.006, minor * .18);
  const segments = quality === 'cinematic' ? 12 : quality === 'ultra' ? 10 : 8;
  const positions: number[] = [];
  const uv: number[] = [];
  const transform = new T.Matrix4()
    .makeRotationZ(tilt)
    .setPosition(center);

  for (let lane = 0; lane < count; lane++) {
    // Distribute ribbons over the front-facing (+Z) or upper (+Y) hemisphere.
    // Slight lane-dependent bends break up parallel, computer-straight lines.
    const theta = Math.PI * (lane + .5) / count;
    const phase = seed * .71 + lane * 1.61;
    const left: T.Vector3[] = [];
    const right: T.Vector3[] = [];

    for (let step = 0; step <= segments; step++) {
      const u = step / segments;
      const t = -.89 + u * 1.78;
      const angle = theta + .07 * Math.sin(u * Math.PI * 1.7 + phase);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const shell = (1.017 + lane % 2 * .004) * Math.sqrt(1 - t * t);
      const ribbonWidth = width * (.07 + .93 * Math.pow(Math.sin(Math.PI * u), .7));
      const point = new T.Vector3();
      const across = new T.Vector3();

      if (axis === 'y') {
        point.set(rx * shell * cos, ry * t, rz * shell * sin);
        across.set(-rx * sin, 0, rz * cos);
      } else if (axis === 'z') {
        point.set(rx * shell * cos, ry * shell * sin, rz * t);
        across.set(-rx * sin, ry * cos, 0);
      } else {
        point.set(rx * t, ry * shell * cos, rz * shell * sin);
        across.set(0, -ry * sin, rz * cos);
      }

      across.normalize().multiplyScalar(ribbonWidth * .5);
      left.push(point.clone().sub(across).applyMatrix4(transform));
      right.push(point.clone().add(across).applyMatrix4(transform));
    }

    const vertex = (point: T.Vector3, across: number, along: number) => {
      positions.push(point.x, point.y, point.z);
      uv.push(across, along);
    };
    for (let segment = 0; segment < segments; segment++) {
      const a = segment / segments;
      const b = (segment + 1) / segments;
      vertex(left[segment], 0, a);
      vertex(right[segment], 1, a);
      vertex(left[segment + 1], 0, b);
      vertex(right[segment], 1, a);
      vertex(right[segment + 1], 1, b);
      vertex(left[segment + 1], 0, b);
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.rockmundoScalpStrandRibbons = count;
  geometry.userData.rockmundoScalpStrandAxis = axis;
  return geometry;
}
