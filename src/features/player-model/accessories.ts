import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { buildHeadAccessory, tuckHair } from './accessoryGeometry';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';

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

export function addAccessories(root: T.Object3D, appearance: PlayerAppearance, head: T.Bone, richClothing: ResolvedEquippedClothing[] = []) {
  const accessories = { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b', earrings: 'none', earringColor: '#d8ad49', ...(appearance.accessories ?? {}) };
  const storeSlots = new Set(richClothing.map(row => richGarmentSlot(row.item)));
  if (storeSlots.has('headwear')) accessories.hat = 'none';
  if (storeSlots.has('eyewear')) accessories.glasses = 'none';
  if (accessories.hat === 'none' && accessories.glasses === 'none' && accessories.earrings === 'none' && !storeSlots.has('headwear')) return;

  const bounds = headSkinBounds(root);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  const rx = size.x * .5, rz = size.z * .5;
  const anchor = new T.Group();
  anchor.name = 'avatar-accessories';

  if (accessories.hat !== 'none' || storeSlots.has('headwear')) tuckHair(root, bounds, appearance.body.frame);
  if (accessories.hat !== 'none') {
    const style = accessories.hat === 'baseball_cap' ? 'cap' : accessories.hat === 'bucket_hat' ? 'bucket' : accessories.hat;
    const hat = buildHeadAccessory({ slot: 'headwear', style, color: accessories.hatColor }, bounds);
    hat.name = `avatar-hat-${accessories.hat}`;
    anchor.add(hat);
  }
  if (accessories.glasses !== 'none') {
    const style = accessories.glasses === 'square' ? 'rectangle' : accessories.glasses === 'sunglasses' ? 'wayfarer' : accessories.glasses;
    const glasses = buildHeadAccessory({
      slot: 'eyewear', style, color: accessories.glassesColor,
      lenses: appearance.accessories?.lensTint ?? (accessories.glasses === 'sunglasses' ? 'tinted' : 'clear'),
      lensColor: appearance.accessories?.lensColor ?? '#40566d',
    }, bounds);
    glasses.name = `avatar-glasses-${accessories.glasses}`;
    anchor.add(glasses);
  }

  if (accessories.earrings !== 'none') {
    const earrings = new T.Group();
    earrings.name = `avatar-earrings-${accessories.earrings}`;
    const metal = material(accessories.earringColor, 'AccessoryEarring', .9, .22);
    const earY = center.y - size.y * .015;
    const earZ = center.z + rz * .03;
    for (const side of [-1, 1]) {
      const earX = center.x + side * rx * .985;
      if (accessories.earrings === 'studs') {
        const stud = mesh(new T.SphereGeometry(size.x * .028, 12, 8), metal.clone(), 'earring-stud');
        stud.position.set(earX, earY, earZ);
        earrings.add(stud);
      } else if (accessories.earrings === 'hoops') {
        const hoop = mesh(new T.TorusGeometry(size.y * .055, size.x * .012, 8, 22, Math.PI * 1.86), metal.clone(), 'earring-hoop');
        hoop.position.set(earX, earY - size.y * .035, earZ);
        hoop.rotation.z = side * .05;
        earrings.add(hoop);
      } else {
        const stud = mesh(new T.SphereGeometry(size.x * .022, 10, 8), metal.clone(), 'earring-drop-stud');
        stud.position.set(earX, earY, earZ);
        earrings.add(stud);
        const link = mesh(new T.CylinderGeometry(size.x * .008, size.x * .008, size.y * .09, 8), metal.clone(), 'earring-drop-link');
        link.position.set(earX, earY - size.y * .055, earZ);
        earrings.add(link);
        const drop = mesh(new T.SphereGeometry(size.x * .034, 12, 8), metal.clone(), 'earring-drop');
        drop.scale.y = 1.3;
        drop.position.set(earX, earY - size.y * .115, earZ);
        earrings.add(drop);
      }
    }
    anchor.add(earrings);
  }

  root.add(anchor);
  root.updateMatrixWorld(true);
  head.attach(anchor);
  root.updateMatrixWorld(true);
}
