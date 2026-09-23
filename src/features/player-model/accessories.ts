import * as T from 'three';
import type { PlayerAppearance } from './appearance';
import { buildHeadAccessory, tuckHair } from './accessoryGeometry';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';
import { richGarmentSlot } from '@/features/clothing-preview/richGarmentVisuals';
import { avatarQualityProfile, type AvatarVisualQuality } from './avatarVisualQuality';

function isHeadSurfaceMesh(root: T.Object3D, node: T.SkinnedMesh) {
  let parent: T.Object3D | null = node;
  while (parent) {
    if (/_Head(?:_|$)/i.test(parent.name)) return true;
    if (
      root.userData.rockmundoAvatarEngine === 'rockmundo-v2' &&
      (
        parent.userData?.rockmundoHeadSurface === true ||
        /(?:rmv2|rockmundo)[_-]?(?:head|face)(?:surface)?/i.test(parent.name) ||
        /(?:head|face)[_-]?surface/i.test(parent.name)
      )
    ) return true;
    parent = parent.parent;
  }
  return false;
}

function headSkinSurface(root: T.Object3D) {
  const bounds = new T.Box3();
  const points: T.Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    if (!isHeadSurfaceMesh(root, node)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (!materials.some(material => /skin/i.test(material.name))) return;
    node.skeleton.update();
    for (let i = 0; i < node.geometry.attributes.position.count; i += 1) {
      const point = node.getVertexPosition(i, new T.Vector3()).applyMatrix4(node.matrixWorld);
      bounds.expandByPoint(point);
      points.push(point);
    }
  });
  return { bounds, points };
}

function fittedEarPoint(
  points: T.Vector3[],
  bounds: T.Box3,
  side: -1 | 1,
) {
  if (!points.length || bounds.isEmpty()) return null;
  const center = bounds.getCenter(new T.Vector3());
  const size = bounds.getSize(new T.Vector3());
  const targetY = center.y - size.y * .055;
  const targetZ = center.z + size.z * .05;
  let best: T.Vector3 | null = null;
  let bestScore = Infinity;

  for (const point of points) {
    const sideDepth = side < 0 ? Math.abs(point.x - bounds.min.x) : Math.abs(bounds.max.x - point.x);
    const score =
      sideDepth * 4.5 +
      Math.abs(point.y - targetY) * 2.1 +
      Math.abs(point.z - targetZ) * .7;
    if (score < bestScore) {
      bestScore = score;
      best = point;
    }
  }

  if (!best) return null;
  return best.clone().add(new T.Vector3(side * size.x * .012, -size.y * .01, size.z * .006));
}



function fittedEyeCenters(
  root: T.Object3D,
  bounds: T.Box3,
  frame: PlayerAppearance['body']['frame'],
) {
  if (bounds.isEmpty()) return { leftEye: null, rightEye: null };
  const strong: T.Vector3[] = [];
  const fallback: T.Vector3[] = [];
  const center = bounds.getCenter(new T.Vector3());
  const size = bounds.getSize(new T.Vector3());

  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof T.SkinnedMesh)) return;
    if (!isHeadSurfaceMesh(root, node)) return;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const groups = node.geometry.groups.length
      ? node.geometry.groups
      : [{ start: 0, count: node.geometry.index?.count ?? node.geometry.attributes.position.count, materialIndex: 0 }];
    node.skeleton.update();

    for (const group of groups) {
      const material = materials[group.materialIndex ?? 0];
      if (!material) continue;
      const name = material.name.toLowerCase();
      const isStrong = /iris|pupil|eye/.test(name) || (frame === 'feminine' && name === 'brown');
      const isFallback = name === 'white';
      if (!isStrong && !isFallback) continue;

      const target = isStrong ? strong : fallback;
      const end = Math.min(group.start + group.count, node.geometry.index?.count ?? node.geometry.attributes.position.count);
      for (let cursor = group.start; cursor < end; cursor++) {
        const vertexIndex = node.geometry.index ? node.geometry.index.getX(cursor) : cursor;
        const point = node.getVertexPosition(vertexIndex, new T.Vector3()).applyMatrix4(node.matrixWorld);
        if (isFallback && point.y < center.y + size.y * .02) continue;
        target.push(point);
      }
    }
  });

  const points = strong.length ? strong : fallback;
  const average = (side: -1 | 1) => {
    const selected = points.filter(point => side < 0 ? point.x < center.x : point.x > center.x);
    if (!selected.length) return null;
    return selected.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / selected.length);
  };

  return { leftEye: average(-1), rightEye: average(1) };
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

export function addAccessories(
  root: T.Object3D,
  appearance: PlayerAppearance,
  head: T.Bone,
  richClothing: ResolvedEquippedClothing[] = [],
  quality: AvatarVisualQuality = 'balanced',
) {
  const profile = avatarQualityProfile(quality);
  const accessories = { hat: 'none', hatColor: '#20232b', glasses: 'none', glassesColor: '#20232b', earrings: 'none', leftEarring: appearance.accessories?.earrings ?? 'none', rightEarring: appearance.accessories?.earrings ?? 'none', earringColor: '#d8ad49', ...(appearance.accessories ?? {}) };
  const storeSlots = new Set(richClothing.map(row => richGarmentSlot(row.item)));
  if (storeSlots.has('headwear')) accessories.hat = 'none';
  if (storeSlots.has('eyewear')) accessories.glasses = 'none';
  if (accessories.hat === 'none' && accessories.glasses === 'none' && (accessories.leftEarring ?? accessories.earrings) === 'none' && (accessories.rightEarring ?? accessories.earrings) === 'none' && !storeSlots.has('headwear')) return;

  const headSurface = headSkinSurface(root);
  const bounds = headSurface.bounds;
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
  const rx = size.x * .5, rz = size.z * .5;
  const leftEarFit = fittedEarPoint(headSurface.points, bounds, -1);
  const rightEarFit = fittedEarPoint(headSurface.points, bounds, 1);
  const eyeFit = fittedEyeCenters(root, bounds, appearance.body.frame);
  const anchor = new T.Group();
  anchor.name = 'avatar-accessories';

  if (accessories.hat !== 'none' || storeSlots.has('headwear')) tuckHair(root, bounds, appearance.body.frame);
  if (accessories.hat !== 'none') {
    const style = accessories.hat === 'baseball_cap' ? 'cap' : accessories.hat === 'bucket_hat' ? 'bucket' : accessories.hat;
    const hat = buildHeadAccessory({ slot: 'headwear', style, color: accessories.hatColor }, bounds, quality);
    hat.name = `avatar-hat-${accessories.hat}`;
    anchor.add(hat);
  }
  if (accessories.glasses !== 'none') {
    const style = accessories.glasses === 'square' ? 'rectangle' : accessories.glasses === 'sunglasses' ? 'wayfarer' : accessories.glasses;
    const glasses = buildHeadAccessory({
      slot: 'eyewear', style, color: accessories.glassesColor,
      lenses: appearance.accessories?.lensTint ?? (accessories.glasses === 'sunglasses' ? 'tinted' : 'clear'),
      lensColor: appearance.accessories?.lensColor ?? '#40566d',
    }, bounds, quality, {
      ...eyeFit,
      leftEar: leftEarFit,
      rightEar: rightEarFit,
    });
    glasses.name = `avatar-glasses-${accessories.glasses}`;
    anchor.add(glasses);
  }

  const leftStyle = accessories.leftEarring ?? accessories.earrings;
  const rightStyle = accessories.rightEarring ?? accessories.earrings;
  if (leftStyle !== 'none' || rightStyle !== 'none') {
    const earrings = new T.Group();
    earrings.name = 'avatar-earrings';
    const metal = quality === 'crowd' || quality === 'balanced'
      ? material(accessories.earringColor, 'AccessoryEarring', .92, .2)
      : new T.MeshPhysicalMaterial({
          color: accessories.earringColor,
          metalness: .94,
          roughness: quality === 'cinematic' ? .08 : quality === 'ultra' ? .11 : .15,
          clearcoat: .7,
          clearcoatRoughness: .06,
          envMapIntensity: quality === 'cinematic' ? 1.9 : quality === 'ultra' ? 1.7 : 1.45,
        });
    metal.name = 'AccessoryEarring';
    for (const side of [-1, 1] as const) {
      const style = side < 0 ? leftStyle : rightStyle;
      if (style === 'none') continue;
      const fitted = side < 0 ? leftEarFit : rightEarFit;
      const earX = fitted?.x ?? center.x + side * rx * .965;
      const earY = fitted?.y ?? center.y - size.y * .055;
      const earZ = fitted?.z ?? center.z + rz * .10;
      const sideGroup = new T.Group();
      sideGroup.name = `avatar-earring-${side < 0 ? 'left' : 'right'}-${style}`;
      if (style === 'studs') {
        const stud = mesh(new T.SphereGeometry(size.x * .024, profile.accessorySegments, Math.max(8, Math.floor(profile.accessorySegments * .7))), metal.clone(), 'earring-stud');
        stud.position.set(earX, earY, earZ);
        sideGroup.add(stud);
      } else if (style === 'hoops') {
        const hoop = mesh(new T.TorusGeometry(size.y * .048, size.x * .010, Math.max(8, Math.floor(profile.accessorySegments / 2)), Math.max(22, profile.accessorySegments * 2), Math.PI * 1.9), metal.clone(), 'earring-hoop');
        hoop.position.set(earX, earY - size.y * .040, earZ + rz * .015);
        hoop.rotation.y = Math.PI / 2;
        hoop.rotation.x = side * .06;
        sideGroup.add(hoop);
      } else {
        const stud = mesh(new T.SphereGeometry(size.x * .020, profile.accessorySegments, Math.max(8, Math.floor(profile.accessorySegments * .7))), metal.clone(), 'earring-drop-stud');
        stud.position.set(earX, earY, earZ);
        sideGroup.add(stud);
        const link = mesh(new T.CylinderGeometry(size.x * .007, size.x * .007, size.y * .078, Math.max(8, profile.accessorySegments)), metal.clone(), 'earring-drop-link');
        link.position.set(earX, earY - size.y * .050, earZ);
        sideGroup.add(link);
        const drop = mesh(new T.SphereGeometry(size.x * .030, profile.accessorySegments, Math.max(8, Math.floor(profile.accessorySegments * .7))), metal.clone(), 'earring-drop');
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
