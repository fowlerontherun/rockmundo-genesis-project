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
  const accessories = { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b', earrings: 'none', leftEarring: appearance.accessories?.earrings ?? 'none', rightEarring: appearance.accessories?.earrings ?? 'none', earringColor: '#d8ad49', ...(appearance.accessories ?? {}) };
  const storeSlots = new Set(richClothing.map(row => richGarmentSlot(row.item)));
  if (storeSlots.has('headwear')) accessories.hat = 'none';
  if (storeSlots.has('eyewear')) accessories.glasses = 'none';
  if (accessories.hat === 'none' && accessories.glasses === 'none' && (accessories.leftEarring ?? accessories.earrings) === 'none' && (accessories.rightEarring ?? accessories.earrings) === 'none' && !storeSlots.has('headwear')) return;

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

  const leftStyle = accessories.leftEarring ?? accessories.earrings;
  const rightStyle = accessories.rightEarring ?? accessories.earrings;
  if (leftStyle !== 'none' || rightStyle !== 'none') {
    const earrings = new T.Group();
    earrings.name = 'avatar-earrings';
    const metal = material(accessories.earringColor, 'AccessoryEarring', .9, .22);
    const earY = center.y - size.y * .055;
    const earZ = center.z + rz * .10;
    for (const side of [-1, 1] as const) {
      const style = side < 0 ? leftStyle : rightStyle;
      if (style === 'none') continue;
      const earX = center.x + side * rx * .965;
      const sideGroup = new T.Group();
      sideGroup.name = `avatar-earring-${side < 0 ? 'left' : 'right'}-${style}`;
      if (style === 'studs') {
        const stud = mesh(new T.SphereGeometry(size.x * .024, 12, 8), metal.clone(), 'earring-stud');
        stud.position.set(earX, earY, earZ);
        sideGroup.add(stud);
      } else if (style === 'hoops') {
        const hoop = mesh(new T.TorusGeometry(size.y * .048, size.x * .010, 8, 22, Math.PI * 1.9), metal.clone(), 'earring-hoop');
        hoop.position.set(earX, earY - size.y * .040, earZ + rz * .015);
        hoop.rotation.y = Math.PI / 2;
        hoop.rotation.x = side * .06;
        sideGroup.add(hoop);
      } else {
        const stud = mesh(new T.SphereGeometry(size.x * .020, 10, 8), metal.clone(), 'earring-drop-stud');
        stud.position.set(earX, earY, earZ);
        sideGroup.add(stud);
        const link = mesh(new T.CylinderGeometry(size.x * .007, size.x * .007, size.y * .078, 8), metal.clone(), 'earring-drop-link');
        link.position.set(earX, earY - size.y * .050, earZ);
        sideGroup.add(link);
        const drop = mesh(new T.SphereGeometry(size.x * .030, 12, 8), metal.clone(), 'earring-drop');
        drop.scale.y = 1.25;
        drop.position.set(earX, earY - size.y * .100, earZ);
        sideGroup.add(drop);
      }
      earrings.add(sideGroup);
    }
    anchor.add(earrings);
  }

  root.add(anchor);
  root.updateMatrixWorld(true);
  head.attach(anchor);
  root.updateMatrixWorld(true);
}
