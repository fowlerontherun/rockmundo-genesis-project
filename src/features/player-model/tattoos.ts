import * as T from 'three';
import { BODY_SLOTS, TATTOO_CATEGORIES, type BodySlot, type TattooCategory } from '@/data/tattooDesigns';
import type { ResolvedEquippedClothing } from '@/features/clothing-preview/equippedClothing';

export interface ResolvedTattooVisual {
  id: string;
  profile_id: string;
  body_slot: BodySlot;
  ink_color: string;
  quality_score: number;
  is_infected: boolean;
  category: TattooCategory | 'custom';
}

export interface TattooVisualInput {
  id?: unknown;
  profile_id?: unknown;
  body_slot?: unknown;
  ink_color?: unknown;
  quality_score?: unknown;
  is_infected?: unknown;
  category?: unknown;
}

const tattooSlots = new Set<BodySlot>(Object.keys(BODY_SLOTS) as BodySlot[]);
const tattooCategories = new Set<TattooCategory>(TATTOO_CATEGORIES);

export function normalizeTattooVisual(value: TattooVisualInput, fallbackProfileId = ''): ResolvedTattooVisual | null {
  const id = typeof value.id === 'string' ? value.id : '';
  const profileId = typeof value.profile_id === 'string' && value.profile_id ? value.profile_id : fallbackProfileId;
  const bodySlot = typeof value.body_slot === 'string' ? value.body_slot as BodySlot : null;
  if (!id || !profileId || !bodySlot || !tattooSlots.has(bodySlot)) return null;
  const categoryValue = typeof value.category === 'string' ? value.category : '';
  const category = tattooCategories.has(categoryValue as TattooCategory) ? categoryValue as TattooCategory : 'custom';
  const rawInk = typeof value.ink_color === 'string' ? value.ink_color : '';
  return {
    id,
    profile_id: profileId,
    body_slot: bodySlot,
    ink_color: /^#[0-9a-fA-F]{6}$/.test(rawInk) ? rawInk.toLowerCase() : '#1d232d',
    quality_score: Math.max(0, Math.min(100, Number(value.quality_score) || 0)),
    is_infected: value.is_infected === true,
    category,
  };
}


function clothingCoverageSlots(clothing: ResolvedEquippedClothing): BodySlot[] {
  const config = clothing.item.garment_config as Record<string, unknown> | null | undefined;
  const raw = config?.tattooCoverageSlots ?? config?.tattoo_coverage_slots;
  if (!Array.isArray(raw)) return [];
  return raw.filter((slot): slot is BodySlot => typeof slot === 'string' && tattooSlots.has(slot as BodySlot));
}

/** Clothing metadata is authoritative for tattoo occlusion. We never infer coverage
 * from item names, so new garments can define sleeves/necklines precisely. */
export function visibleTattoosForClothing(
  tattoos: ResolvedTattooVisual[] = [],
  clothing: ResolvedEquippedClothing[] = [],
): ResolvedTattooVisual[] {
  if (!tattoos.length || !clothing.length) return tattoos;
  const covered = new Set<BodySlot>();
  for (const item of clothing) for (const slot of clothingCoverageSlots(item)) covered.add(slot);
  return covered.size ? tattoos.filter(tattoo => !covered.has(tattoo.body_slot)) : tattoos;
}

const childBone = (bone: T.Bone, names: string[]) => bone.children.find(child => child instanceof T.Bone && names.some(name => cleanName(child.name).includes(cleanName(name)))) as T.Bone | undefined;
const cleanName = (value: string) => value.replace(/[_.]/g, '').toLowerCase();

function findBone(bones: Map<string, T.Bone>, candidates: string[]) {
  for (const bone of bones.values()) {
    const name = cleanName(bone.name);
    if (candidates.some(candidate => name === cleanName(candidate))) return bone;
  }
}

function tattooPatternTexture(tattoo: ResolvedTattooVisual) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  let seed = 2166136261;
  for (const char of `${tattoo.id}:${tattoo.category}`) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  const noise = (x: number, y: number) => {
    let n = Math.imul(x + 37, 374761393) ^ Math.imul(y + 17, 668265263) ^ seed;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const line = (distance: number, width: number) => Math.max(0, 1 - Math.abs(distance) / width);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size, px = u * 2 - 1, py = v * 2 - 1;
    const radius = Math.sqrt(px * px + py * py);
    let alpha = 0;
    if (tattoo.category === 'fine_line') {
      alpha = Math.max(line(radius - .56, .028), line(py - px * .35, .025) * (radius < .72 ? 1 : 0));
    } else if (tattoo.category === 'geometric') {
      alpha = Math.max(line(((x + y + (seed % 13)) % 16) - 8, 1.4), line(((x - y + 128 + (seed % 9)) % 19) - 9.5, 1.1));
      if (radius > .76) alpha *= .25;
    } else if (tattoo.category === 'musical') {
      const staff = [20, 26, 32, 38, 44].some(row => Math.abs(y - row) < 1.1) ? .72 : 0;
      const noteA = ((x - 24) ** 2) / 28 + ((y - 37) ** 2) / 16 < 1 ? 1 : 0;
      const noteB = ((x - 42) ** 2) / 30 + ((y - 28) ** 2) / 18 < 1 ? .95 : 0;
      const stems = (Math.abs(x - 28) < 1.4 && y > 17 && y < 38) || (Math.abs(x - 46) < 1.4 && y > 10 && y < 29) ? .9 : 0;
      alpha = Math.max(staff, noteA, noteB, stems);
    } else if (tattoo.category === 'text') {
      const rows = [23, 30, 38, 45];
      alpha = rows.some(row => Math.abs(y - row) < 1.4 && x > 10 + ((row + seed) % 8) && x < 55 - ((row + seed) % 11)) ? .88 : 0;
      if ((x + y + seed) % 17 < 3) alpha *= .2;
    } else if (tattoo.category === 'blackwork') {
      const angular = Math.max(line(Math.abs(px) + Math.abs(py) - .62, .07), line(py + px * .72, .08));
      alpha = Math.max(angular, radius < .25 ? .96 : 0);
    } else if (tattoo.category === 'tribal') {
      alpha = Math.max(line(radius - (.37 + .09 * Math.sin(Math.atan2(py, px) * 3)), .075), line(py + .25 * Math.sin(px * 7), .065));
    } else if (tattoo.category === 'sleeve') {
      alpha = Math.max(line(Math.sin((u * 5 + v * 3) * Math.PI), .16), noise(x, y) > .82 ? .72 : 0);
    } else if (tattoo.category === 'abstract') {
      const blot = noise(Math.floor(x / 4), Math.floor(y / 4));
      alpha = blot > .66 && radius < .86 ? Math.min(1, (blot - .66) * 3.4) : 0;
      alpha = Math.max(alpha, line(py - Math.sin(px * 5 + (seed % 7)) * .23, .04));
    } else if (tattoo.category === 'portrait' || tattoo.category === 'realism') {
      const face = Math.max(0, 1 - radius / .78);
      const eyeBand = line(py + .16, .055) * (Math.abs(px) < .55 ? 1 : 0);
      alpha = Math.max(face * (.25 + noise(x, y) * .62), eyeBand * .9);
    } else if (tattoo.category === 'traditional' || tattoo.category === 'japanese') {
      const outer = line(radius - .61, .065);
      const inner = Math.max(0, 1 - Math.abs(px * .75) - Math.abs(py * 1.05));
      alpha = Math.max(outer, inner > .35 ? .78 : 0, line(py - Math.sin(px * 4) * .18, .045));
    } else if (tattoo.category === 'skull') {
      const head = radius < .62 ? .52 : 0;
      const eye = (((px - .22) / .14) ** 2 + ((py + .12) / .12) ** 2 < 1) || (((px + .22) / .14) ** 2 + ((py + .12) / .12) ** 2 < 1) ? 1 : 0;
      const jaw = Math.abs(px) < .3 && py > .28 && py < .65 ? .82 : 0;
      alpha = Math.max(head, eye, jaw);
    } else {
      alpha = Math.max(line(radius - .55, .07), radius < .34 ? .55 : 0);
    }
    const value = Math.max(0, Math.min(255, Math.round(alpha * 255)));
    const index = (y * size + x) * 4;
    data[index] = value; data[index + 1] = value; data[index + 2] = value; data[index + 3] = 255;
  }
  const texture = new T.DataTexture(data, size, size, T.RGBAFormat);
  texture.name = `tattoo-pattern-${tattoo.category}`;
  texture.colorSpace = T.NoColorSpace;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function tattooMaterial(tattoo: ResolvedTattooVisual) {
  const color = new T.Color(tattoo.ink_color || '#1d232d');
  if (tattoo.is_infected) color.lerp(new T.Color('#7e2635'), .35);
  const material = new T.MeshStandardMaterial({
    color,
    roughness: .94,
    metalness: 0,
    transparent: true,
    opacity: Math.max(.58, Math.min(.96, .58 + tattoo.quality_score * .0038)),
    alphaMap: tattooPatternTexture(tattoo),
    alphaTest: .025,
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
  const geometry = new T.CylinderGeometry(radius, radius * .98, length, 32, 2, true, thetaStart, thetaLength);
  const hash = [...`${tattoo.id}:${tattoo.category}`].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  geometry.rotateY((hash % 7 - 3) * .055);
  const mark = new T.Mesh(geometry, tattooMaterial(tattoo));
  mark.name = `avatar-tattoo-${tattoo.id}`;
  mark.position.copy(center);
  mark.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
  root.add(mark);
  root.updateMatrixWorld(true);
  bone.attach(mark);
}

function torsoMark(root: T.Object3D, bone: T.Bone, tattoo: ResolvedTattooVisual, back = false, yOffset = .02, depth = .145) {
  root.updateMatrixWorld(true);
  const center = bone.getWorldPosition(new T.Vector3());
  const categoryScale: Partial<Record<ResolvedTattooVisual['category'], number>> = { sleeve: 1.22, portrait: 1.14, realism: 1.16, traditional: 1.05, blackwork: 1.08, fine_line: .82, text: .84, geometric: .92 };
  const scale = categoryScale[tattoo.category] ?? 1;
  const geometry = tattoo.category === 'geometric'
    ? new T.RingGeometry(.035 * scale, .095 * scale, 12)
    : tattoo.category === 'musical'
      ? new T.RingGeometry(.028 * scale, .078 * scale, 30, 1, .3, Math.PI * 1.65)
      : tattoo.category === 'fine_line'
        ? new T.RingGeometry(.055 * scale, .064 * scale, 32)
        : new T.CircleGeometry(.085 * scale, tattoo.category === 'tribal' || tattoo.category === 'blackwork' ? 8 : 32);
  const mark = new T.Mesh(geometry, tattooMaterial(tattoo));
  mark.name = `avatar-tattoo-${tattoo.id}`;
  mark.position.copy(center).add(new T.Vector3(0, yOffset, back ? -depth : depth));
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
  const stomach = findBone(bones, ['Spine', 'Spine0', 'Spine.000', 'Hips']) ?? findBone(bones, ['Spine1', 'Spine.001']);
  const upperLegL = findBone(bones, ['UpperLeg.L', 'UpperLeg_L', 'LeftUpperLeg']);
  const upperLegR = findBone(bones, ['UpperLeg.R', 'UpperLeg_R', 'RightUpperLeg']);
  const lowerLegL = findBone(bones, ['LowerLeg.L', 'LowerLeg_L', 'LeftLowerLeg']);
  const lowerLegR = findBone(bones, ['LowerLeg.R', 'LowerLeg_R', 'RightLowerLeg']);
  const footL = findBone(bones, ['Foot.L', 'Foot_L', 'LeftFoot']);
  const footR = findBone(bones, ['Foot.R', 'Foot_R', 'RightFoot']);

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
    else if (tattoo.body_slot === 'stomach' && stomach) torsoMark(root, stomach, tattoo, false, .055, .135);
    else if (tattoo.body_slot === 'back' && chest) torsoMark(root, chest, tattoo, true);
    else if (tattoo.body_slot === 'left_thigh' && upperLegL) wrapSegment(root, upperLegL, lowerLegL, tattoo, .12, .68, -.8, 1.55, .092);
    else if (tattoo.body_slot === 'right_thigh' && upperLegR) wrapSegment(root, upperLegR, lowerLegR, tattoo, .12, .68, -.8, 1.55, .092);
    else if (tattoo.body_slot === 'left_calf' && lowerLegL) wrapSegment(root, lowerLegL, footL, tattoo, .16, .72, -.78, 1.5, .066);
    else if (tattoo.body_slot === 'right_calf' && lowerLegR) wrapSegment(root, lowerLegR, footR, tattoo, .16, .72, -.78, 1.5, .066);
  }
}
