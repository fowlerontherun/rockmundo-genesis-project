import * as T from 'three';
import type { BodySlot, TattooCategory } from '@/data/tattooDesigns';

export interface ResolvedTattooVisual {
  id: string;
  profile_id: string;
  body_slot: BodySlot;
  ink_color: string;
  quality_score: number;
  is_infected: boolean;
  category: TattooCategory | 'custom';
}

const childBone = (bone: T.Bone, names: string[]) => bone.children.find(child => child instanceof T.Bone && names.some(name => child.name.replace(/[_.]/g, '').includes(name))) as T.Bone | undefined;
const cleanName = (value: string) => value.replace(/[_.]/g, '').toLowerCase();

function findBone(bones: Map<string, T.Bone>, candidates: string[]) {
  for (const bone of bones.values()) {
    const name = cleanName(bone.name);
    if (candidates.some(candidate => name === cleanName(candidate))) return bone;
  }
}

function tattooMaterial(tattoo: ResolvedTattooVisual) {
  const color = new T.Color(tattoo.ink_color || '#1d232d');
  if (tattoo.is_infected) color.lerp(new T.Color('#7e2635'), .35);
  const material = new T.MeshStandardMaterial({
    color,
    roughness: .98,
    metalness: 0,
    transparent: true,
    opacity: Math.max(.42, Math.min(.9, tattoo.quality_score / 110)),
    side: T.DoubleSide,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  material.name = 'TattooInk';
  return material;
}

function wrapSegment(root: T.Object3D, bone: T.Bone, child: T.Bone | undefined, tattoo: ResolvedTattooVisual, start = .18, end = .66, thetaStart = -.7, thetaLength = 1.55, radius = .064) {
  root.updateMatrixWorld(true);
  const a = bone.getWorldPosition(new T.Vector3()), b = child?.getWorldPosition(new T.Vector3()) ?? a.clone().add(new T.Vector3(0, -.28, 0));
  const direction = b.clone().sub(a), length = Math.max(.08, direction.length() * Math.max(.18, end - start));
  const center = a.clone().lerp(b, (start + end) / 2);
  const geometry = new T.CylinderGeometry(radius, radius * .98, length, 18, 1, true, thetaStart, thetaLength);
  const hash = [...tattoo.category].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  geometry.rotateY((hash % 7 - 3) * .055);
  const mark = new T.Mesh(geometry, tattooMaterial(tattoo));
  mark.name = `avatar-tattoo-${tattoo.id}`;
  mark.position.copy(center);
  mark.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
  root.add(mark);
  root.updateMatrixWorld(true);
  bone.attach(mark);
}

function torsoMark(root: T.Object3D, bone: T.Bone, tattoo: ResolvedTattooVisual, back = false) {
  root.updateMatrixWorld(true);
  const center = bone.getWorldPosition(new T.Vector3());
  const categoryScale: Partial<Record<ResolvedTattooVisual['category'], number>> = { sleeve: 1.22, portrait: 1.14, text: .84, geometric: .92 };
  const scale = categoryScale[tattoo.category] ?? 1;
  const geometry = tattoo.category === 'geometric'
    ? new T.RingGeometry(.035 * scale, .095 * scale, 6)
    : tattoo.category === 'musical'
      ? new T.RingGeometry(.028 * scale, .078 * scale, 18, 1, .3, Math.PI * 1.65)
      : new T.CircleGeometry(.085 * scale, tattoo.category === 'tribal' ? 5 : 18);
  const mark = new T.Mesh(geometry, tattooMaterial(tattoo));
  mark.name = `avatar-tattoo-${tattoo.id}`;
  mark.position.copy(center).add(new T.Vector3(0, .02, back ? -.14 : .145));
  mark.rotation.y = back ? Math.PI : 0;
  root.add(mark);
  root.updateMatrixWorld(true);
  bone.attach(mark);
}

export function addTattoos(root: T.Object3D, tattoos: ResolvedTattooVisual[] = [], bones: Map<string, T.Bone>) {
  if (!tattoos.length) return;
  const upperL = findBone(bones, ['UpperArm.L', 'UpperArm_L', 'LeftUpperArm']);
  const upperR = findBone(bones, ['UpperArm.R', 'UpperArm_R', 'RightUpperArm']);
  const lowerL = findBone(bones, ['LowerArm.L', 'LowerArm_L', 'LeftLowerArm']);
  const lowerR = findBone(bones, ['LowerArm.R', 'LowerArm_R', 'RightLowerArm']);
  const neck = findBone(bones, ['Neck']);
  const chest = findBone(bones, ['Spine2', 'Spine.002', 'Chest', 'UpperChest']) ?? findBone(bones, ['Spine1', 'Spine.001']);

  for (const tattoo of tattoos) {
    if (tattoo.body_slot === 'left_shoulder' && upperL) wrapSegment(root, upperL, lowerL, tattoo, .02, .27, -.55, 1.8, .071);
    else if (tattoo.body_slot === 'left_upper_arm' && upperL) wrapSegment(root, upperL, lowerL, tattoo, .25, .72);
    else if (tattoo.body_slot === 'left_inner_arm' && upperL) wrapSegment(root, upperL, lowerL, tattoo, .32, .72, 2.15, 1.32);
    else if (tattoo.body_slot === 'left_forearm' && lowerL) wrapSegment(root, lowerL, childBone(lowerL, ['hand', 'wrist']), tattoo, .12, .68, -.72, 1.5, .055);
    else if (tattoo.body_slot === 'left_wrist' && lowerL) wrapSegment(root, lowerL, childBone(lowerL, ['hand', 'wrist']), tattoo, .72, .93, -.95, 1.9, .049);
    else if (tattoo.body_slot === 'right_shoulder' && upperR) wrapSegment(root, upperR, lowerR, tattoo, .02, .27, -.55, 1.8, .071);
    else if (tattoo.body_slot === 'right_upper_arm' && upperR) wrapSegment(root, upperR, lowerR, tattoo, .25, .72);
    else if (tattoo.body_slot === 'right_inner_arm' && upperR) wrapSegment(root, upperR, lowerR, tattoo, .32, .72, 2.15, 1.32);
    else if (tattoo.body_slot === 'right_forearm' && lowerR) wrapSegment(root, lowerR, childBone(lowerR, ['hand', 'wrist']), tattoo, .12, .68, -.72, 1.5, .055);
    else if (tattoo.body_slot === 'right_wrist' && lowerR) wrapSegment(root, lowerR, childBone(lowerR, ['hand', 'wrist']), tattoo, .72, .93, -.95, 1.9, .049);
    else if (tattoo.body_slot === 'neck' && neck) wrapSegment(root, neck, findBone(bones, ['Head']), tattoo, .04, .52, -.7, 1.45, .067);
    else if (tattoo.body_slot === 'chest' && chest) torsoMark(root, chest, tattoo, false);
    else if (tattoo.body_slot === 'back' && chest) torsoMark(root, chest, tattoo, true);
  }
}
