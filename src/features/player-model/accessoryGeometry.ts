import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { isScalpHair } from './hair';

export interface HeadAccessorySpec {
  slot: 'headwear' | 'eyewear';
  style: string;
  color: string;
  lensColor?: string;
  lenses?: 'clear' | 'tinted';
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
export function buildHeadAccessory(spec: HeadAccessorySpec, bounds: T.Box3): T.Group {
  const group = new T.Group(); group.name = `avatar-${spec.slot}`;
  group.userData.style = spec.style;
  const size = bounds.getSize(new T.Vector3()), c = bounds.getCenter(new T.Vector3());
  const w = size.x, h = size.y, d = size.z, top = bounds.max.y;
  const material = new T.MeshStandardMaterial({ color: spec.color, roughness: spec.slot === 'headwear' ? .88 : .3, metalness: spec.slot === 'eyewear' ? .45 : 0 });
  material.name = 'AvatarAccessory';
  const add = (geometry: T.BufferGeometry, name: string, x: number, y: number, z: number, mat: T.Material = material) => {
    const mesh = new T.Mesh(geometry, mat); mesh.name = name; mesh.position.set(x, y, z);
    mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
  };
  if (spec.slot === 'eyewear') {
    const eyeY = top - h * .405, front = bounds.max.z + d * .012;
    const lensW = w * .19, lensH = h * (spec.style === 'rectangle' ? .072 : .098);
    const lensMaterial = new T.MeshPhysicalMaterial({ color: spec.lensColor ?? '#40566d', transparent: true, opacity: spec.lenses === 'tinted' ? .72 : .13, roughness: .08, metalness: 0, depthWrite: false, side: T.DoubleSide });
    lensMaterial.name = 'AvatarLens';
    for (const side of [-1, 1]) {
      const shape = lensShape(spec.style, lensW, lensH);
      const points = shape.getPoints(32).map(p => new T.Vector3(p.x, p.y, 0));
      const curve = new T.CatmullRomCurve3(points, true);
      add(new T.TubeGeometry(curve, 64, w * (spec.style === 'wayfarer' ? .015 : .010), 6, true), `glasses-frame-${side}`, c.x + side * w * .235, eyeY, front);
      add(new T.ShapeGeometry(shape, 32), `glasses-lens-${side}`, c.x + side * w * .235, eyeY, front, lensMaterial).castShadow = false;
      const length = Math.max(d * .60, front - c.z);
      const templeX = c.x + side * w * .43;
      add(new T.BoxGeometry(w * .016, h * .020, length), `glasses-arm-${side}`, templeX, eyeY + h * .005, front - length * .5);
      const hook = add(new T.BoxGeometry(w * .016, h * .075, d * .028), `glasses-ear-hook-${side}`, templeX, eyeY - h * .025, front - length);
      hook.rotation.x = side * .04;
    }
    add(new T.BoxGeometry(w * .095, h * .019, d * .022), 'glasses-bridge', c.x, eyeY + h * .018, front);
    if (spec.style === 'aviator') add(new T.BoxGeometry(w * .14, h * .015, d * .02), 'glasses-brow-bar', c.x, eyeY + lensH * .75, front);
  } else {
    const bottom = top - h * .20, rx = w * .56, rz = d * .57;
    const ring = (name: string, radius: number, y: number, tube: number, mat = material) => {
      const mesh = add(new T.TorusGeometry(radius, tube, 8, 48), name, c.x, y, c.z, mat);
      mesh.rotation.x = Math.PI / 2; mesh.scale.y = rz / rx; return mesh;
    };
    const dome = (height: number) => {
      const mesh = add(new T.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 'hat-crown', c.x, bottom, c.z);
      mesh.scale.set(rx, height, rz); return mesh;
    };
    if (spec.style === 'cap' || spec.style === 'beanie') {
      dome(h * (spec.style === 'cap' ? .29 : .36));
      ring('hat-band', rx * .96, bottom + h * .025, h * (spec.style === 'beanie' ? .045 : .018));
      if (spec.style === 'cap') {
        const visor = add(new T.SphereGeometry(1, 32, 12), 'cap-visor', c.x, bottom, c.z + rz * .82);
        visor.scale.set(rx * .93, h * .023, rz * .78);
        add(new T.SphereGeometry(w * .025, 12, 8), 'cap-button', c.x, bottom + h * .29, c.z);
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
      const crown = add(new T.CylinderGeometry(rx * (bucket ? .85 : .80), rx, h * .30, 32), 'hat-crown', c.x, bottom + h * .15, c.z);
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
      const brim = new T.RingGeometry(rx * .94, rx * (bucket ? 1.32 : spec.style === 'cowboy' ? 1.65 : 1.48), 48, 3);
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
      if (p.y <= brim) continue; // retain long hair below the hat
      p.y = brim + Math.min(size.y * .10, (p.y - brim) * .25);
      p.x = c.x + T.MathUtils.clamp(p.x - c.x, -size.x * .47, size.x * .47);
      p.z = c.z + T.MathUtils.clamp(p.z - c.z, -size.z * .47, size.z * .47);
      p.applyMatrix4(inverse); vertices.setXYZ(i, p.x, p.y, p.z);
    }
    vertices.needsUpdate = true; node.geometry.computeVertexNormals(); node.geometry.computeBoundingSphere();
  });
}
