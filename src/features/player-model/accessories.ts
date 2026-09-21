import * as T from 'three';
import type { PlayerAppearance } from './appearance';

function headSkinBounds(root: T.Object3D) {
  const bounds = new T.Box3();
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    let parent: T.Object3D | null = node;
    while (parent && !/_Head(?:_|$)/i.test(parent.name)) parent = parent.parent;
    if (!parent) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some(material => /skin/i.test(material.name))) return;
    node.skeleton.update();
    for (let i = 0; i < node.geometry.attributes.position.count; i += 1) {
      bounds.expandByPoint(node.getVertexPosition(i, new T.Vector3()).applyMatrix4(node.matrixWorld));
    }
  });
  return bounds;
}

function material(color: string, name: string, metalness = 0, roughness = .78) {
  const result = new T.MeshStandardMaterial({ color, metalness, roughness });
  result.name = name;
  return result;
}

function mesh(geometry: T.BufferGeometry, mat: T.Material, name: string) {
  const result = new T.Mesh(geometry, mat);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export function addAccessories(root: T.Object3D, appearance: PlayerAppearance, head: T.Bone) {
  const accessories = appearance.accessories ?? { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b' };
  if (accessories.hat === 'none' && accessories.glasses === 'none') return;

  const bounds = headSkinBounds(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  const rx = size.x * .5, rz = size.z * .5, top = bounds.max.y, front = bounds.max.z;
  const anchor = new T.Group();
  anchor.name = 'avatar-accessories';

  if (accessories.hat !== 'none') {
    const hat = new T.Group();
    hat.name = `avatar-hat-${accessories.hat}`;
    const hatMaterial = material(accessories.hatColor, 'AccessoryHat');
    if (accessories.hat === 'beanie') {
      const crown = mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .62), hatMaterial, 'beanie-crown');
      crown.scale.set(rx * 1.08, size.y * .22, rz * 1.08);
      crown.position.set(center.x, top - size.y * .15, center.z - rz * .02);
      hat.add(crown);
      const band = mesh(new T.CylinderGeometry(rx * 1.04, rx * 1.04, size.y * .08, 28, 1, true), hatMaterial.clone(), 'beanie-band');
      band.scale.z = rz / rx;
      band.position.set(center.x, top - size.y * .23, center.z);
      hat.add(band);
    } else if (accessories.hat === 'baseball_cap') {
      const crown = mesh(new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .58), hatMaterial, 'cap-crown');
      crown.scale.set(rx * 1.06, size.y * .18, rz * 1.08);
      crown.position.set(center.x, top - size.y * .13, center.z);
      hat.add(crown);
      const brim = mesh(new T.BoxGeometry(rx * 1.4, size.y * .025, rz * .72), hatMaterial.clone(), 'cap-brim');
      brim.position.set(center.x, top - size.y * .20, front + rz * .28);
      brim.rotation.x = -.08;
      hat.add(brim);
    } else if (accessories.hat === 'bucket_hat') {
      const crown = mesh(new T.CylinderGeometry(rx * .82, rx * 1.0, size.y * .24, 28, 1, false), hatMaterial, 'bucket-crown');
      crown.scale.z = rz / rx;
      crown.position.set(center.x, top - size.y * .10, center.z);
      hat.add(crown);
      const brim = mesh(new T.CylinderGeometry(rx * 1.32, rx * 1.12, size.y * .045, 32, 1, false), hatMaterial.clone(), 'bucket-brim');
      brim.scale.z = rz / rx;
      brim.position.set(center.x, top - size.y * .23, center.z);
      hat.add(brim);
    } else {
      const crown = mesh(new T.CylinderGeometry(rx * .68, rx * .82, size.y * .21, 28, 1, false), hatMaterial, 'fedora-crown');
      crown.scale.z = rz / rx;
      crown.position.set(center.x, top - size.y * .08, center.z);
      hat.add(crown);
      const brim = mesh(new T.CylinderGeometry(rx * 1.35, rx * 1.35, size.y * .025, 32, 1, false), hatMaterial.clone(), 'fedora-brim');
      brim.scale.z = rz / rx;
      brim.position.set(center.x, top - size.y * .19, center.z);
      hat.add(brim);
      const band = mesh(new T.TorusGeometry(rx * .78, size.y * .018, 8, 36), material('#111318', 'AccessoryHatBand'), 'fedora-band');
      band.scale.z = rz / rx;
      band.rotation.x = Math.PI / 2;
      band.position.set(center.x, top - size.y * .16, center.z);
      hat.add(band);
    }
    anchor.add(hat);
  }

  if (accessories.glasses !== 'none') {
    const glasses = new T.Group();
    glasses.name = `avatar-glasses-${accessories.glasses}`;
    const frame = material(accessories.glassesColor, 'AccessoryGlasses', .25, .35);
    const lensY = center.y + size.y * .11, lensZ = front + rz * .045, lensX = rx * .42;
    const round = accessories.glasses === 'round' || accessories.glasses === 'aviator';
    const sunglasses = accessories.glasses === 'sunglasses';
    const addLens = (side: number) => {
      if (round) {
        const ring = mesh(new T.TorusGeometry(rx * (accessories.glasses === 'aviator' ? .29 : .25), size.x * .018, 8, 24), frame.clone(), 'glasses-frame');
        ring.position.set(center.x + side * lensX, lensY, lensZ);
        if (accessories.glasses === 'aviator') ring.scale.y = .82;
        glasses.add(ring);
      } else {
        const width = rx * .56, height = size.y * (sunglasses ? .18 : .15), thickness = size.x * .026;
        for (const [dx, dy, sx, sy] of [[0, height / 2, width, thickness], [0, -height / 2, width, thickness], [-width / 2, 0, thickness, height], [width / 2, 0, thickness, height]] as const) {
          const bar = mesh(new T.BoxGeometry(sx, sy, size.z * .02), frame.clone(), 'glasses-frame');
          bar.position.set(center.x + side * lensX + dx, lensY + dy, lensZ);
          glasses.add(bar);
        }
      }
      if (sunglasses) {
        const lensMaterial = new T.MeshStandardMaterial({ color: '#111722', roughness: .15, metalness: .15, transparent: true, opacity: .76, side: T.DoubleSide });
        lensMaterial.name = 'AccessoryLens';
        const lens = mesh(new T.PlaneGeometry(rx * .54, size.y * .16), lensMaterial, 'sunglasses-lens');
        lens.position.set(center.x + side * lensX, lensY, lensZ + .004);
        glasses.add(lens);
      }
    };
    addLens(-1); addLens(1);
    const bridge = mesh(new T.BoxGeometry(rx * .30, size.y * .018, size.z * .025), frame.clone(), 'glasses-bridge');
    bridge.position.set(center.x, lensY, lensZ);
    glasses.add(bridge);
    for (const side of [-1, 1]) {
      const arm = mesh(new T.BoxGeometry(rx * .7, size.y * .018, size.z * .018), frame.clone(), 'glasses-arm');
      arm.position.set(center.x + side * rx * .74, lensY, center.z + rz * .10);
      arm.rotation.y = side * .56;
      glasses.add(arm);
    }
    anchor.add(glasses);
  }

  root.add(anchor);
  root.updateMatrixWorld(true);
  head.attach(anchor);
  root.updateMatrixWorld(true);
}
