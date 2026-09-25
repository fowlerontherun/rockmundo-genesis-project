import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { isScalpHair } from './hair';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

export interface HeadAccessorySpec {
  slot: 'headwear' | 'eyewear';
  style: string;
  color: string;
  lensColor?: string;
  lenses?: 'clear' | 'tinted';
}

export interface HeadAccessoryFit {
  leftEye?: T.Vector3 | null;
  rightEye?: T.Vector3 | null;
  leftEar?: T.Vector3 | null;
  rightEar?: T.Vector3 | null;
}

function lensShape(style: string, w: number, h: number): T.Shape {
  const s = new T.Shape();
  if (style === 'round') s.absellipse(0, 0, w, h, 0, Math.PI * 2, false, 0);
  else if (style === 'aviator') {
    s.moveTo(-w, h * .4); s.bezierCurveTo(-w, h * 1.2, w, h * 1.2, w, h * .35);
    s.bezierCurveTo(w, -h * .8, w * .1, -h * 1.3, -w * .6, -h * .65);
    s.quadraticCurveTo(-w, -h * .3, -w, h * .4);
  } else {
    const bottom = style === 'wayfarer' ? w * .78 : w;
    s.moveTo(-w * .8, h); s.lineTo(w * .8, h); s.quadraticCurveTo(w, h, w, h * .65);
    s.lineTo(bottom, -h * .6); s.quadraticCurveTo(bottom, -h, bottom * .75, -h);
    s.lineTo(-bottom * .75, -h); s.quadraticCurveTo(-bottom, -h, -bottom, -h * .6);
    s.lineTo(-w, h * .65); s.quadraticCurveTo(-w, h, -w * .8, h);
  }
  return s;
}

/** Starter geometry is authored around the face in rest world space, then
 * attached to Head by the shared fitting-room and stage assembly. */
export function buildHeadAccessory(
  spec: HeadAccessorySpec,
  bounds: T.Box3,
  quality: AvatarVisualQuality = 'balanced',
  fit: HeadAccessoryFit = {},
): T.Group {
  const profile = avatarQualityProfile(quality);
  const group = new T.Group(); group.name = `avatar-${spec.slot}`;
  group.userData.style = spec.style;
  const size = bounds.getSize(new T.Vector3()), c = bounds.getCenter(new T.Vector3());
  const w = size.x, h = size.y, d = size.z, top = bounds.max.y;
  const material = new T.MeshStandardMaterial({
    color: spec.color,
    roughness: spec.slot === 'headwear' ? .86 : (quality === 'cinematic' ? .16 : quality === 'ultra' ? .2 : .28),
    metalness: spec.slot === 'eyewear' ? .5 : 0,
    envMapIntensity: spec.slot === 'eyewear' ? (quality === 'cinematic' ? 1.7 : quality === 'ultra' ? 1.5 : 1.2) : .9,
  });
  material.name = 'AvatarAccessory';
  const add = (geometry: T.BufferGeometry, name: string, x: number, y: number, z: number, mat: T.Material = material) => {
    const mesh = new T.Mesh(geometry, mat); mesh.name = name; mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  if (spec.slot === 'eyewear') {
    const fittedEyes = fit.leftEye && fit.rightEye ? [fit.leftEye, fit.rightEye] as const : null;
    const eyeY = fittedEyes ? (fittedEyes[0].y + fittedEyes[1].y) * .5 : top - h * .405;
    const front = fittedEyes ? Math.max(fittedEyes[0].z, fittedEyes[1].z) + d * .012 : bounds.max.z + d * .012;
    const fittedSeparation = fittedEyes ? Math.abs(fittedEyes[1].x - fittedEyes[0].x) : w * .47;
    const lensW = T.MathUtils.clamp(fittedSeparation * .40, w * .16, w * .21);
    const lensH = h * (spec.style === 'rectangle' ? .072 : .098);
    const lensMaterial = new T.MeshPhysicalMaterial({
      color: spec.lensColor ?? '#40566d',
      transparent: true,
      opacity: spec.lenses === 'tinted' ? .72 : .13,
      roughness: quality === 'cinematic' ? .025 : quality === 'ultra' ? .035 : .07,
      metalness: 0,
      clearcoat: quality === 'crowd' ? 0 : 1,
      clearcoatRoughness: quality === 'cinematic' ? .018 : quality === 'ultra' ? .025 : .06,
      ior: 1.45,
      envMapIntensity: quality === 'cinematic' ? 1.8 : quality === 'ultra' ? 1.6 : 1.25,
      depthWrite: false,
      side: T.DoubleSide,
    });
    lensMaterial.name = 'AvatarLens';
    for (const side of [-1, 1]) {
      const shape = lensShape(spec.style, lensW, lensH);
      const curvePoints = quality === 'cinematic' ? 80 : quality === 'ultra' ? 64 : quality === 'high' ? 48 : 32;
      const points = shape.getPoints(curvePoints).map(p => new T.Vector3(p.x, p.y, 0));
      const curve = new T.CatmullRomCurve3(points, true);
      const eye = side < 0 ? fit.leftEye : fit.rightEye;
      const ear = side < 0 ? fit.leftEar : fit.rightEar;
      const lensX = eye?.x ?? c.x + side * w * .235;
      const lensY = eye?.y ?? eyeY;
      add(new T.TubeGeometry(curve, Math.max(48, profile.accessorySegments * 3), w * (spec.style === 'wayfarer' ? .015 : .010), Math.max(6, Math.floor(profile.accessorySegments / 2)), true), `glasses-frame-${side}`, lensX, lensY, front);
      add(new T.ShapeGeometry(shape, curvePoints), `glasses-lens-${side}`, lensX, lensY, front, lensMaterial).castShadow = false;

      // V1's left eye is at -X, but the V2 Blender rig's Eye.L is at +X.
      // Derive the OUTWARD direction from the actual fitted ear/eye instead of
      // assuming that the saved semantic "left" always has a fixed X sign.
      const outward = Math.sign((ear?.x ?? eye?.x ?? (c.x + side * w * .235)) - c.x) || side;
      const rimHinge = new T.Vector3(lensX + outward * lensW * .98, lensY + h * .018, front);
      const earPoint = ear?.clone() ?? new T.Vector3(c.x + outward * w * .49, lensY - h * .04, c.z);
      // The spectacle arm rests above the lobe. The short curved hook finishes
      // just below that point rather than a rectangular block floating by it.
      const templeRest = earPoint.clone().add(new T.Vector3(0, h * .035, 0));
      const firstBend = rimHinge.clone().lerp(templeRest, .34);
      const secondBend = rimHinge.clone().lerp(templeRest, .76);
      firstBend.x += outward * w * .009;
      secondBend.x += outward * w * .006;
      const templePath = new T.CatmullRomCurve3([rimHinge, firstBend, secondBend, templeRest]);
      const arm = add(
        new T.TubeGeometry(
          templePath,
          Math.max(12, profile.accessorySegments * 2),
          w * (spec.style === 'wayfarer' ? .011 : .008),
          Math.max(6, Math.floor(profile.accessorySegments / 2)),
          false,
        ),
        `glasses-arm-${side}`, 0, 0, 0,
      );
      arm.userData.rockmundoTempleFit = {
        hinge: rimHinge.toArray(),
        rest: templeRest.toArray(),
        side: side < 0 ? 'L' : 'R',
        outward,
      };
      const hookPath = new T.CatmullRomCurve3([
        new T.Vector3(),
        new T.Vector3(outward * w * .002, -h * .025, -d * .004),
        new T.Vector3(outward * w * .006, -h * .047, -d * .009),
      ]);
      const hook = add(
        new T.TubeGeometry(hookPath, 8, w * .008, 6, false),
        `glasses-ear-hook-${side}`, templeRest.x, templeRest.y, templeRest.z,
      );
      hook.userData.rockmundoEarAnchor = earPoint.toArray();
    }
    add(new T.BoxGeometry(w * .095, h * .019, d * .022), 'glasses-bridge', c.x, eyeY + h * .018, front);
    if (spec.style === 'aviator') add(new T.BoxGeometry(w * .14, h * .015, d * .02), 'glasses-brow-bar', c.x, eyeY + lensH * .75, front);
  } else {
    const bottom = top - h * .20, rx = w * .56, rz = d * .57;
    const ring = (name: string, radius: number, y: number, tube: number, mat = material) => {
      const mesh = add(new T.TorusGeometry(radius, tube, Math.max(8, Math.floor(profile.accessorySegments / 2)), Math.max(48, profile.accessorySegments * 3)), name, c.x, y, c.z, mat);
      mesh.rotation.x = Math.PI / 2; mesh.scale.y = rz / rx; return mesh;
    };
    const dome = (height: number) => {
      const mesh = add(new T.SphereGeometry(1, Math.max(24, profile.accessorySegments * 2), Math.max(12, profile.accessorySegments), 0, Math.PI * 2, 0, Math.PI / 2), 'hat-crown', c.x, bottom, c.z);
      mesh.scale.set(rx, height, rz); return mesh;
    };
    if (spec.style === 'cap' || spec.style === 'beanie') {
      dome(h * (spec.style === 'cap' ? .29 : .36));
      ring('hat-band', rx * .96, bottom + h * .025, h * (spec.style === 'beanie' ? .045 : .018));
      if (spec.style === 'cap') {
        const visor = add(new T.SphereGeometry(1, Math.max(24, profile.accessorySegments * 2), Math.max(12, profile.accessorySegments)), 'cap-visor', c.x, bottom, c.z + rz * .82);
        visor.scale.set(rx * .93, h * .023, rz * .78);
        add(new T.SphereGeometry(w * .025, Math.max(12, profile.accessorySegments), Math.max(8, Math.floor(profile.accessorySegments * .7))), 'cap-button', c.x, bottom + h * .29, c.z);
        const seamMaterial = material.clone(); seamMaterial.color.multiplyScalar(.7);
        for (const angle of [-.8, 0, .8]) {
          const points = Array.from({ length: 25 }, (_, i) => {
            const t = i / 24 * Math.PI / 2;
            return new T.Vector3(c.x + Math.sin(angle) * rx * Math.sin(t) * 1.01, bottom + h * .29 * Math.cos(t) + .001, c.z + Math.cos(angle) * rz * Math.sin(t) * 1.01);
          });
          add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, w * .003, 4, false), 'cap-seam', 0, 0, 0, seamMaterial);
        }
      }
    } else {
      const bucket = spec.style === 'bucket';
      const crown = add(new T.CylinderGeometry(rx * (bucket ? .85 : .80), rx, h * .30, Math.max(32, profile.accessorySegments * 2)), 'hat-crown', c.x, bottom + h * .15, c.z);
      crown.scale.z = rz / rx;
      if (!bucket) {
        const points = crown.geometry.attributes.position;
        for (let i = 0; i < points.count; i++) {
          if (points.getY(i) <= 0) continue;
          const x = points.getX(i), z = points.getZ(i);
          // A shallow centre crease and pinched front distinguish these crowns
          // from a flat-topped cylinder without adding model downloads.
          points.setY(i, points.getY(i) - h * .07 * Math.max(0, 1 - Math.abs(x) / (rx * .65)));
          if (z > 0) points.setX(i, x * (1 - .14 * z / rx));
        }
        crown.geometry.computeVertexNormals();
      }
      const brim = new T.RingGeometry(rx * .94, rx * (bucket ? 1.32 : spec.style === 'cowboy' ? 1.65 : 1.48), Math.max(48, profile.accessorySegments * 3), quality === 'cinematic' ? 8 : quality === 'ultra' ? 6 : quality === 'high' ? 4 : 3);
      brim.rotateX(-Math.PI / 2); brim.scale(1, 1, rz / rx);
      const vertices = brim.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i), z = vertices.getZ(i), radius = Math.sqrt((x / rx) ** 2 + (z / rz) ** 2);
        vertices.setY(i, bucket ? -Math.max(0, radius - 1) * h * .25 : spec.style === 'cowboy' ? Math.pow(Math.abs(x / rx), 3) * h * .04 : 0);
      }
      brim.computeVertexNormals(); material.side = T.DoubleSide;
      add(brim, 'hat-brim', c.x, bottom, c.z);
      const bandMaterial = material.clone(); bandMaterial.color.multiplyScalar(.45);
      ring('hat-band', rx * .965, bottom + h * .065, h * .025, bandMaterial);
    }
    group.userData.hairline = bottom;
  }
  return group;
}

export interface HeadAccessoryHairClearanceOptions {
  glasses?: boolean;
  leftEarring?: boolean;
  rightEarring?: boolean;
}

export interface HeadAccessoryHairClearanceResult {
  adjustedVertices: number;
  glassesVertices: number;
  earringVertices: number;
}

/**
 * Procedural hairstyles are built before accessories, so use their real rendered
 * vertices to cut narrow clearance channels around glasses temples and earrings.
 * This keeps accessories fitted to the measured face/ears instead of solving
 * clipping by making them float farther away from the character.
 */
export function clearHairForHeadAccessories(
  root: T.Object3D,
  bounds: T.Box3,
  fit: HeadAccessoryFit = {},
  options: HeadAccessoryHairClearanceOptions = {},
): HeadAccessoryHairClearanceResult {
  const result: HeadAccessoryHairClearanceResult = {
    adjustedVertices: 0,
    glassesVertices: 0,
    earringVertices: 0,
  };
  if (bounds.isEmpty() || (!options.glasses && !options.leftEarring && !options.rightEarring)) return result;

  const center = bounds.getCenter(new T.Vector3());
  const size = bounds.getSize(new T.Vector3());
  const fallbackEyeY = bounds.max.y - size.y * .405;
  const fallbackEyeZ = bounds.max.z + size.z * .012;
  const fallbackEarY = center.y - size.y * .055;
  const fallbackEarZ = center.z + size.z * .05;

  const fittedPoint = (side: -1 | 1, kind: 'eye' | 'ear') => {
    const supplied = kind === 'eye'
      ? (side < 0 ? fit.leftEye : fit.rightEye)
      : (side < 0 ? fit.leftEar : fit.rightEar);
    if (supplied) return supplied;
    return new T.Vector3(
      center.x + side * size.x * (kind === 'eye' ? .235 : .49),
      kind === 'eye' ? fallbackEyeY : fallbackEarY,
      kind === 'eye' ? fallbackEyeZ : fallbackEarZ,
    );
  };

  const leftEye = fittedPoint(-1, 'eye');
  const rightEye = fittedPoint(1, 'eye');
  const front = Math.max(leftEye.z, rightEye.z) + size.z * .012;
  const lensWidth = T.MathUtils.clamp(
    Math.abs(rightEye.x - leftEye.x) * .40,
    size.x * .16,
    size.x * .21,
  );

  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof T.Mesh) || node.name !== 'avatar-hairstyle') return;
    const vertices = node.geometry.attributes.position;
    const inverse = node.matrixWorld.clone().invert();

    for (let index = 0; index < vertices.count; index++) {
      const point = new T.Vector3().fromBufferAttribute(vertices, index).applyMatrix4(node.matrixWorld);
      const originalX = point.x;
      let glassesAdjusted = false;
      let earringAdjusted = false;

      if (options.glasses) {
        for (const side of [-1, 1] as const) {
          const eye = fittedPoint(side, 'eye');
          const ear = fittedPoint(side, 'ear');
          const outward = Math.sign(ear.x - center.x) || side;
          const hingeX = eye.x + outward * lensWidth * .98;
          const t = T.MathUtils.clamp((front - point.z) / Math.max(.001, front - ear.z), 0, 1);
          // Clear along the actual lens-rim -> ear route, not a fixed strip by
          // the ear. This also supports V2's +X left-eye authoring convention.
          const templeX = T.MathUtils.lerp(hingeX, ear.x, t);
          const templeY = T.MathUtils.lerp(eye.y + size.y * .018, ear.y + size.y * .035, t);
          const zMin = Math.min(front, ear.z) - size.z * .10;
          const zMax = Math.max(front, ear.z) + size.z * .12;
          const sameSide = outward * (point.x - center.x) > 0;
          if (!sameSide || Math.abs(point.y - templeY) > size.y * .12 || point.z < zMin || point.z > zMax) continue;
          if (Math.abs(point.x - templeX) > size.x * .075) continue;

          const targetX = templeX + outward * size.x * .08;
          point.x = outward < 0 ? Math.min(point.x, targetX) : Math.max(point.x, targetX);
          glassesAdjusted = glassesAdjusted || Math.abs(point.x - originalX) > 1e-6;
        }
      }

      for (const side of [-1, 1] as const) {
        const enabled = side < 0 ? options.leftEarring : options.rightEarring;
        if (!enabled) continue;
        const ear = fittedPoint(side, 'ear');
        const outward = Math.sign(ear.x - center.x) || side;
        const sameSide = outward * (point.x - center.x) > 0;
        if (!sameSide) continue;
        if (Math.abs(point.y - ear.y) > size.y * .16 || Math.abs(point.z - ear.z) > size.z * .20) continue;
        if (outward * (point.x - ear.x) >= size.x * .10) continue;

        const targetX = ear.x + outward * size.x * .095;
        const before = point.x;
        point.x = outward < 0 ? Math.min(point.x, targetX) : Math.max(point.x, targetX);
        earringAdjusted = earringAdjusted || Math.abs(point.x - before) > 1e-6;
      }

      if (Math.abs(point.x - originalX) <= 1e-6) continue;
      const local = point.applyMatrix4(inverse);
      vertices.setXYZ(index, local.x, local.y, local.z);
      result.adjustedVertices += 1;
      if (glassesAdjusted) result.glassesVertices += 1;
      if (earringAdjusted) result.earringVertices += 1;
    }

    vertices.needsUpdate = true;
    node.geometry.computeVertexNormals();
    node.geometry.computeBoundingBox();
    node.geometry.computeBoundingSphere();
  });

  root.userData.rockmundoAccessoryHairClearance = result;
  return result;
}

export function tuckHair(root: T.Object3D, bounds: T.Box3, frame: PlayerAppearance['body']['frame']) {
  const c = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  const brim = bounds.max.y - size.y * .20;
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    // The imported haircut is one mesh; only hide scalp hair, never brows/eyes.
    if (node instanceof T.SkinnedMesh && materials.every(m => isScalpHair(m, frame))) node.visible = false;
    if (node.name !== 'avatar-hairstyle') return;
    const inverse = node.matrixWorld.clone().invert(), vertices = node.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const p = new T.Vector3().fromBufferAttribute(vertices, i).applyMatrix4(node.matrixWorld);
      if (p.y <= brim) {
        // Keep long hair, but pull the narrow band immediately beneath the brim
        // down so the brim does not slice through side panels/locs/braids.
        if (p.y >= brim - size.y * .055) {
          p.y = Math.min(p.y, brim - size.y * .018);
          p.x = c.x + T.MathUtils.clamp(p.x - c.x, -size.x * .50, size.x * .50);
          p.z = c.z + T.MathUtils.clamp(p.z - c.z, -size.z * .50, size.z * .50);
          p.applyMatrix4(inverse); vertices.setXYZ(i, p.x, p.y, p.z);
        }
        continue;
      }
      p.y = brim + Math.min(size.y * .085, (p.y - brim) * .22);
      p.x = c.x + T.MathUtils.clamp(p.x - c.x, -size.x * .455, size.x * .455);
      p.z = c.z + T.MathUtils.clamp(p.z - c.z, -size.z * .455, size.z * .455);
      p.applyMatrix4(inverse); vertices.setXYZ(i, p.x, p.y, p.z);
    }
    vertices.needsUpdate = true; node.geometry.computeVertexNormals(); node.geometry.computeBoundingBox(); node.geometry.computeBoundingSphere();
  });
}
