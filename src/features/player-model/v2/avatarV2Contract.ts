import * as T from 'three';
import type { PlayerAppearance } from '../appearance';
import { AVATAR_V2_CUSTOMIZATION_MORPHS } from './avatarV2Customization';
import { AVATAR_V2_POSE_CORRECTIVES } from './avatarV2PoseCorrectives';

export type AvatarV2Frame = PlayerAppearance['body']['frame'];
export type AvatarV2Lod = 0 | 1 | 2 | 3;

export const AVATAR_V2_BODY_REGIONS = [
  'torso',
  'upper-arms',
  'lower-arms',
  'hands',
  'hips',
  'upper-legs',
  'lower-legs',
  'feet',
] as const;
export type AvatarV2BodyRegion = typeof AVATAR_V2_BODY_REGIONS[number];

export interface AvatarV2Budget {
  maxTriangles: number;
  maxVertices: number;
  maxBones: number;
  targetTextureSize: number;
}

export const AVATAR_V2_BUDGETS: Record<AvatarV2Lod, AvatarV2Budget> = {
  0: { maxTriangles: 55_000, maxVertices: 65_000, maxBones: 96, targetTextureSize: 2048 },
  1: { maxTriangles: 30_000, maxVertices: 38_000, maxBones: 96, targetTextureSize: 1024 },
  2: { maxTriangles: 12_000, maxVertices: 18_000, maxBones: 80, targetTextureSize: 1024 },
  3: { maxTriangles: 5_000, maxVertices: 8_000, maxBones: 64, targetTextureSize: 512 },
};

export const AVATAR_V2_REQUIRED_BONES = [
  'hips',
  'spine',
  'chest',
  'neck',
  'head',
  'leftUpperArm',
  'leftLowerArm',
  'leftHand',
  'rightUpperArm',
  'rightLowerArm',
  'rightHand',
  'leftUpperLeg',
  'leftLowerLeg',
  'leftFoot',
  'rightUpperLeg',
  'rightLowerLeg',
  'rightFoot',
] as const;

export type AvatarV2Bone = typeof AVATAR_V2_REQUIRED_BONES[number];

export const AVATAR_V2_RUNTIME_BONE_NAMES: Record<AvatarV2Bone, string> = {
  hips: 'Hips',
  spine: 'Spine1',
  chest: 'Spine2',
  neck: 'Neck',
  head: 'Head',
  leftUpperArm: 'UpperArm.L',
  leftLowerArm: 'LowerArm.L',
  leftHand: 'Hand.L',
  rightUpperArm: 'UpperArm.R',
  rightLowerArm: 'LowerArm.R',
  rightHand: 'Hand.R',
  leftUpperLeg: 'UpperLeg.L',
  leftLowerLeg: 'LowerLeg.L',
  leftFoot: 'Foot.L',
  rightUpperLeg: 'UpperLeg.R',
  rightLowerLeg: 'LowerLeg.R',
  rightFoot: 'Foot.R',
};

export const AVATAR_V2_BONE_ALIASES: Record<AvatarV2Bone, string[]> = {
  hips: ['hips', 'pelvis', 'root_hips', 'j_bip_c_hips'],
  spine: ['spine', 'spine1', 'spine_01', 'j_bip_c_spine'],
  chest: ['chest', 'spine2', 'spine_02', 'upperchest', 'j_bip_c_chest'],
  neck: ['neck', 'neck1', 'j_bip_c_neck'],
  head: ['head', 'j_bip_c_head'],
  leftUpperArm: ['leftupperarm', 'upperarm_l', 'left_arm', 'j_bip_l_upperarm'],
  leftLowerArm: ['leftlowerarm', 'lowerarm_l', 'left_forearm', 'j_bip_l_lowerarm'],
  leftHand: ['lefthand', 'hand_l', 'left_hand', 'j_bip_l_hand'],
  rightUpperArm: ['rightupperarm', 'upperarm_r', 'right_arm', 'j_bip_r_upperarm'],
  rightLowerArm: ['rightlowerarm', 'lowerarm_r', 'right_forearm', 'j_bip_r_lowerarm'],
  rightHand: ['righthand', 'hand_r', 'right_hand', 'j_bip_r_hand'],
  leftUpperLeg: ['leftupperleg', 'thigh_l', 'left_thigh', 'j_bip_l_upperleg'],
  leftLowerLeg: ['leftlowerleg', 'calf_l', 'left_calf', 'j_bip_l_lowerleg'],
  leftFoot: ['leftfoot', 'foot_l', 'left_foot', 'j_bip_l_foot'],
  rightUpperLeg: ['rightupperleg', 'thigh_r', 'right_thigh', 'j_bip_r_upperleg'],
  rightLowerLeg: ['rightlowerleg', 'calf_r', 'right_calf', 'j_bip_r_lowerleg'],
  rightFoot: ['rightfoot', 'foot_r', 'right_foot', 'j_bip_r_foot'],
};

export const AVATAR_V2_RECOMMENDED_BONES = [
  'leftToes', 'rightToes',
  'leftShoulder', 'rightShoulder',
  'leftThumbProximal', 'rightThumbProximal',
  'leftIndexProximal', 'rightIndexProximal',
] as const;

export const AVATAR_V2_CLOSEUP_BONE_ALIASES = {
  leftShoulder: ['leftShoulder', 'shoulder_l', 'clavicle_l', 'mixamorigLeftShoulder'],
  rightShoulder: ['rightShoulder', 'shoulder_r', 'clavicle_r', 'mixamorigRightShoulder'],
  leftToes: ['leftToes', 'toe_l', 'toebase_l', 'mixamorigLeftToeBase'],
  rightToes: ['rightToes', 'toe_r', 'toebase_r', 'mixamorigRightToeBase'],
  leftEye: ['Eye.L', 'leftEye', 'eye_l', 'mixamorigLeftEye', 'j_bip_l_eye'],
  rightEye: ['Eye.R', 'rightEye', 'eye_r', 'mixamorigRightEye', 'j_bip_r_eye'],

  leftThumb1: ['Thumb1.L', 'leftThumbProximal', 'leftHandThumb1', 'thumb_01_l', 'mixamorigLeftHandThumb1'],
  leftThumb2: ['Thumb2.L', 'leftThumbIntermediate', 'leftHandThumb2', 'thumb_02_l', 'mixamorigLeftHandThumb2'],
  leftThumb3: ['Thumb3.L', 'leftThumbDistal', 'leftHandThumb3', 'thumb_03_l', 'mixamorigLeftHandThumb3'],
  leftIndex1: ['Index1.L', 'leftIndexProximal', 'leftHandIndex1', 'index_01_l', 'mixamorigLeftHandIndex1'],
  leftIndex2: ['Index2.L', 'leftIndexIntermediate', 'leftHandIndex2', 'index_02_l', 'mixamorigLeftHandIndex2'],
  leftIndex3: ['Index3.L', 'leftIndexDistal', 'leftHandIndex3', 'index_03_l', 'mixamorigLeftHandIndex3'],
  leftMiddle1: ['Middle1.L', 'leftMiddleProximal', 'leftHandMiddle1', 'middle_01_l', 'mixamorigLeftHandMiddle1'],
  leftMiddle2: ['Middle2.L', 'leftMiddleIntermediate', 'leftHandMiddle2', 'middle_02_l', 'mixamorigLeftHandMiddle2'],
  leftMiddle3: ['Middle3.L', 'leftMiddleDistal', 'leftHandMiddle3', 'middle_03_l', 'mixamorigLeftHandMiddle3'],
  leftRing1: ['Ring1.L', 'leftRingProximal', 'leftHandRing1', 'ring_01_l', 'mixamorigLeftHandRing1'],
  leftRing2: ['Ring2.L', 'leftRingIntermediate', 'leftHandRing2', 'ring_02_l', 'mixamorigLeftHandRing2'],
  leftRing3: ['Ring3.L', 'leftRingDistal', 'leftHandRing3', 'ring_03_l', 'mixamorigLeftHandRing3'],
  leftLittle1: ['Pinky1.L', 'leftLittleProximal', 'leftHandPinky1', 'pinky_01_l', 'mixamorigLeftHandPinky1'],
  leftLittle2: ['Pinky2.L', 'leftLittleIntermediate', 'leftHandPinky2', 'pinky_02_l', 'mixamorigLeftHandPinky2'],
  leftLittle3: ['Pinky3.L', 'leftLittleDistal', 'leftHandPinky3', 'pinky_03_l', 'mixamorigLeftHandPinky3'],

  rightThumb1: ['Thumb1.R', 'rightThumbProximal', 'rightHandThumb1', 'thumb_01_r', 'mixamorigRightHandThumb1'],
  rightThumb2: ['Thumb2.R', 'rightThumbIntermediate', 'rightHandThumb2', 'thumb_02_r', 'mixamorigRightHandThumb2'],
  rightThumb3: ['Thumb3.R', 'rightThumbDistal', 'rightHandThumb3', 'thumb_03_r', 'mixamorigRightHandThumb3'],
  rightIndex1: ['Index1.R', 'rightIndexProximal', 'rightHandIndex1', 'index_01_r', 'mixamorigRightHandIndex1'],
  rightIndex2: ['Index2.R', 'rightIndexIntermediate', 'rightHandIndex2', 'index_02_r', 'mixamorigRightHandIndex2'],
  rightIndex3: ['Index3.R', 'rightIndexDistal', 'rightHandIndex3', 'index_03_r', 'mixamorigRightHandIndex3'],
  rightMiddle1: ['Middle1.R', 'rightMiddleProximal', 'rightHandMiddle1', 'middle_01_r', 'mixamorigRightHandMiddle1'],
  rightMiddle2: ['Middle2.R', 'rightMiddleIntermediate', 'rightHandMiddle2', 'middle_02_r', 'mixamorigRightHandMiddle2'],
  rightMiddle3: ['Middle3.R', 'rightMiddleDistal', 'rightHandMiddle3', 'middle_03_r', 'mixamorigRightHandMiddle3'],
  rightRing1: ['Ring1.R', 'rightRingProximal', 'rightHandRing1', 'ring_01_r', 'mixamorigRightHandRing1'],
  rightRing2: ['Ring2.R', 'rightRingIntermediate', 'rightHandRing2', 'ring_02_r', 'mixamorigRightHandRing2'],
  rightRing3: ['Ring3.R', 'rightRingDistal', 'rightHandRing3', 'ring_03_r', 'mixamorigRightHandRing3'],
  rightLittle1: ['Pinky1.R', 'rightLittleProximal', 'rightHandPinky1', 'pinky_01_r', 'mixamorigRightHandPinky1'],
  rightLittle2: ['Pinky2.R', 'rightLittleIntermediate', 'rightHandPinky2', 'pinky_02_r', 'mixamorigRightHandPinky2'],
  rightLittle3: ['Pinky3.R', 'rightLittleDistal', 'rightHandPinky3', 'pinky_03_r', 'mixamorigRightHandPinky3'],
} as const;

export const AVATAR_V2_CLOSEUP_RUNTIME_BONE_NAMES: Record<keyof typeof AVATAR_V2_CLOSEUP_BONE_ALIASES, string> = {
  leftShoulder: 'Shoulder.L',
  rightShoulder: 'Shoulder.R',
  leftToes: 'Toe.L',
  rightToes: 'Toe.R',
  leftEye: 'Eye.L',
  rightEye: 'Eye.R',
  leftThumb1: 'Thumb1.L',
  leftThumb2: 'Thumb2.L',
  leftThumb3: 'Thumb3.L',
  leftIndex1: 'Index1.L',
  leftIndex2: 'Index2.L',
  leftIndex3: 'Index3.L',
  leftMiddle1: 'Middle1.L',
  leftMiddle2: 'Middle2.L',
  leftMiddle3: 'Middle3.L',
  leftRing1: 'Ring1.L',
  leftRing2: 'Ring2.L',
  leftRing3: 'Ring3.L',
  leftLittle1: 'Pinky1.L',
  leftLittle2: 'Pinky2.L',
  leftLittle3: 'Pinky3.L',
  rightThumb1: 'Thumb1.R',
  rightThumb2: 'Thumb2.R',
  rightThumb3: 'Thumb3.R',
  rightIndex1: 'Index1.R',
  rightIndex2: 'Index2.R',
  rightIndex3: 'Index3.R',
  rightMiddle1: 'Middle1.R',
  rightMiddle2: 'Middle2.R',
  rightMiddle3: 'Middle3.R',
  rightRing1: 'Ring1.R',
  rightRing2: 'Ring2.R',
  rightRing3: 'Ring3.R',
  rightLittle1: 'Pinky1.R',
  rightLittle2: 'Pinky2.R',
  rightLittle3: 'Pinky3.R',
};

export const AVATAR_V2_RECOMMENDED_EXPRESSIONS = [
  'visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU',
  'mouthFunnel', 'mouthPucker',
  'eyeSquintLeft', 'eyeSquintRight',
  'browInnerUp', 'browDownLeft', 'browDownRight',
  'cheekSquintLeft', 'cheekSquintRight',
  'mouthStretchLeft', 'mouthStretchRight',
] as const;

export const AVATAR_V2_REQUIRED_MUSCLE_MORPHS = [
  'muscleToned',
  'muscleAthletic',
  'muscleMuscular',
  'muscleBodybuilder',
] as const;

export const AVATAR_V2_REQUIRED_EXPRESSIONS = [
  'blinkLeft',
  'blinkRight',
  'jawOpen',
  'mouthSmile',
] as const;

const EXPRESSION_ALIASES: Record<typeof AVATAR_V2_REQUIRED_EXPRESSIONS[number], string[]> = {
  blinkLeft: ['blinkleft', 'blink_l', 'eyeBlinkLeft', 'eye_blink_l'],
  blinkRight: ['blinkright', 'blink_r', 'eyeBlinkRight', 'eye_blink_r'],
  jawOpen: ['jawopen', 'jaw_open', 'mouthOpen', 'mouth_open'],
  mouthSmile: ['mouthsmile', 'mouth_smile', 'smile', 'mouthSmileLeft'],
};

export const cleanAvatarV2Name = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();
const clean = cleanAvatarV2Name;

/**
 * Stable authored target used by close-up hair, glasses and earring fitting.
 * Keep this naming/metadata rule shared with the runtime compatibility bridge
 * so an asset cannot pass certification and then fail cosmetic fitting.
 */
export function isAvatarV2HeadSurfaceNode(node: T.Object3D) {
  let current: T.Object3D | null = node;
  while (current) {
    if (
      current.userData?.rockmundoHeadSurface === true ||
      /(?:rmv2|rockmundo)[_-]?(?:head|face)(?:surface)?/i.test(current.name) ||
      /(?:head|face)[_-]?surface/i.test(current.name)
    ) return true;
    current = current.parent;
  }
  return false;
}

export function avatarV2BodyRegion(node: T.Object3D): AvatarV2BodyRegion | null {
  const explicit = String(node.userData?.rockmundoBodyRegion || '').toLowerCase();
  if ((AVATAR_V2_BODY_REGIONS as readonly string[]).includes(explicit)) {
    return explicit as AvatarV2BodyRegion;
  }
  const name = clean(node.name);
  return AVATAR_V2_BODY_REGIONS.find(region =>
    name.includes(`rmv2body${clean(region)}`) || name.includes(`body${clean(region)}`)
  ) ?? null;
}

export function avatarV2BoneSemantic(name: string): AvatarV2Bone | null {
  const wanted = clean(name);
  for (const semantic of AVATAR_V2_REQUIRED_BONES) {
    const aliases = [semantic, AVATAR_V2_RUNTIME_BONE_NAMES[semantic], ...AVATAR_V2_BONE_ALIASES[semantic]];
    if (aliases.some(alias => clean(alias) === wanted)) return semantic;
  }
  return null;
}

export function avatarV2RuntimeBoneName(name: string) {
  const semantic = avatarV2BoneSemantic(name);
  return semantic ? AVATAR_V2_RUNTIME_BONE_NAMES[semantic] : name;
}

export interface AvatarV2ValidationIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface AvatarV2ValidationReport {
  valid: boolean;
  frame: AvatarV2Frame;
  lod: AvatarV2Lod;
  triangles: number;
  vertices: number;
  bones: number;
  skinnedMeshes: number;
  morphTargets: string[];
  boneMap: Partial<Record<AvatarV2Bone, string>>;
  issues: AvatarV2ValidationIssue[];
}

function resolveBoneMap(scene: T.Object3D) {
  const byName = new Map<string, string>();
  scene.traverse(node => {
    if (node instanceof T.Bone) byName.set(clean(node.name), node.name);
  });

  const map: Partial<Record<AvatarV2Bone, string>> = {};
  for (const canonical of AVATAR_V2_REQUIRED_BONES) {
    const candidates = [canonical, ...AVATAR_V2_BONE_ALIASES[canonical]].map(clean);
    const match = candidates.map(name => byName.get(name)).find(Boolean);
    if (match) map[canonical] = match;
  }
  return map;
}

function collectMorphTargets(scene: T.Object3D) {
  const result = new Set<string>();
  scene.traverse(node => {
    if (!(node instanceof T.Mesh) || !node.morphTargetDictionary) return;
    Object.keys(node.morphTargetDictionary).forEach(name => result.add(name));
  });
  return [...result].sort();
}

function collectBoneNames(scene: T.Object3D) {
  const names: string[] = [];
  scene.traverse(node => {
    if (node instanceof T.Bone) names.push(node.name);
  });
  return names;
}

function hasAnyAlias(names: string[], aliases: readonly string[]) {
  const available = new Set(names.map(clean));
  return aliases.map(clean).some(alias => available.has(alias));
}

function boneByAliases(scene: T.Object3D, aliases: readonly string[]) {
  const wanted = new Set(aliases.map(clean));
  let match: T.Bone | null = null;
  scene.traverse(node => {
    if (!match && node instanceof T.Bone && wanted.has(clean(node.name))) match = node;
  });
  return match;
}

function inheritsFrom(bone: T.Bone, ancestor: T.Bone) {
  let current: T.Object3D | null = bone.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}

function collectMaterialNames(scene: T.Object3D) {
  const names = new Set<string>();
  scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach(material => {
      if (material.name) names.add(material.name);
    });
  });
  return [...names];
}

function hasMaterialRole(names: string[], role: 'skin' | 'eyes' | 'cornea' | 'teeth' | 'tongue' | 'mouthInterior') {
  const patterns = {
    skin: /rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])/i,
    eyes: /rmv2[_-]?eyes|(^|[_-])(eye|eyes|iris|sclera|cornea)($|[_-])/i,
    cornea: /rmv2[_-]?cornea|cornea|eye[_-]?(shell|surface)|ocular[_-]?shell/i,
    teeth: /rmv2[_-]?teeth|teeth/i,
    tongue: /rmv2[_-]?tongue|tongue/i,
    mouthInterior: /rmv2[_-]?mouth[_-]?(interior|cavity)|oral[_-]?cavity|inner[_-]?mouth/i,
  } as const;
  return names.some(name => patterns[role].test(name));
}

function hasExpression(names: string[], expression: keyof typeof EXPRESSION_ALIASES) {
  const available = new Set(names.map(clean));
  return [expression, ...EXPRESSION_ALIASES[expression]].map(clean).some(name => available.has(name));
}

export function validateAvatarV2Scene(
  scene: T.Object3D,
  frame: AvatarV2Frame,
  lod: AvatarV2Lod,
): AvatarV2ValidationReport {
  const issues: AvatarV2ValidationIssue[] = [];
  let triangles = 0;
  let vertices = 0;
  let skinnedMeshes = 0;
  const bones = new Set<T.Bone>();

  scene.traverse(node => {
    if (node instanceof T.Bone) bones.add(node);
    if (!(node instanceof T.Mesh)) return;
    const position = node.geometry.getAttribute('position');
    if (position) vertices += position.count;
    triangles += node.geometry.index
      ? Math.floor(node.geometry.index.count / 3)
      : Math.floor((position?.count ?? 0) / 3);
    if (node instanceof T.SkinnedMesh) skinnedMeshes += 1;
  });

  if (!skinnedMeshes) {
    issues.push({ level: 'error', code: 'missing-skinned-mesh', message: 'Avatar V2 must contain at least one skinned mesh.' });
  }

  const boneMap = resolveBoneMap(scene);
  for (const bone of AVATAR_V2_REQUIRED_BONES) {
    if (!boneMap[bone]) {
      issues.push({ level: 'error', code: `missing-bone:${bone}`, message: `Required humanoid bone is missing: ${bone}.` });
    }
  }

  // Every LOD can be used by Topless or Tattoo Parlour views, so the complete
  // body/skin contract is universal. Only close-up articulation/material checks
  // remain restricted to LOD0/1 below.
  const regions = new Set<AvatarV2BodyRegion>();
  const unskinnedRegions = new Set<AvatarV2BodyRegion>();
  const bareSkinRegions = new Set<AvatarV2BodyRegion>();
  scene.traverse(node => {
    if (!(node instanceof T.Mesh)) return;
    const region = avatarV2BodyRegion(node);
    if (!region) return;
    regions.add(region);
    if (!(node instanceof T.SkinnedMesh)) unskinnedRegions.add(region);
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some(material => hasMaterialRole([material.name], 'skin'))) bareSkinRegions.add(region);
  });
  for (const region of AVATAR_V2_BODY_REGIONS) {
    if (!regions.has(region)) {
      issues.push({
        level: 'error',
        code: `missing-body-region:${region}`,
        message: `LOD${lod} needs an authored body region for garment occlusion: ${region}.`,
      });
    } else if (unskinnedRegions.has(region)) {
      issues.push({
        level: 'error',
        code: `unskinned-body-region:${region}`,
        message: `Avatar V2 body region must be skinned to the humanoid rig: ${region}.`,
      });
    } else if (!bareSkinRegions.has(region)) {
      issues.push({
        level: 'error',
        code: `missing-bare-skin-region:${region}`,
        message: `Avatar V2 body region needs a skin material so topless and Tattoo Parlour unclothed views never expose a garment-shaped hole: ${region}.`,
      });
    }
  }

  if (lod <= 1) {
    let usableHeadSurface = false;
    scene.traverse(node => {
      if (usableHeadSurface || !(node instanceof T.SkinnedMesh) || !isAvatarV2HeadSurfaceNode(node)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      usableHeadSurface = materials.some(material => /skin|face/i.test(material.name));
    });
    if (!usableHeadSurface) {
      issues.push({
        level: 'error',
        code: 'missing-head-surface',
        message: `LOD${lod} needs a skinned RMV2 head/face surface with a named skin material for saved hair and accessory fitting.`,
      });
    }
  }

  const boneNames = collectBoneNames(scene);
  if (lod <= 1) {
    for (const [semantic, aliases] of Object.entries(AVATAR_V2_CLOSEUP_BONE_ALIASES)) {
      if (!hasAnyAlias(boneNames, aliases)) {
        issues.push({
          level: 'error',
          code: `missing-closeup-bone:${semantic}`,
          message: `LOD${lod} is missing close-up articulation bone: ${semantic}.`,
        });
      }
    }

    const headName = boneMap.head;
    const headBone = headName ? scene.getObjectByName(headName) : null;
    if (headBone instanceof T.Bone) {
      for (const semantic of ['leftEye', 'rightEye'] as const) {
        const eye = boneByAliases(scene, AVATAR_V2_CLOSEUP_BONE_ALIASES[semantic]);
        if (eye && !inheritsFrom(eye, headBone)) {
          issues.push({
            level: 'error',
            code: `invalid-eye-parent:${semantic}`,
            message: `LOD${lod} ${semantic} must inherit from the head bone so gaze follows head animation.`,
          });
        }
      }
    }
  }

  const morphTargets = collectMorphTargets(scene);
  const morphTargetNames = new Set(morphTargets.map(clean));
  for (const muscleMorph of AVATAR_V2_REQUIRED_MUSCLE_MORPHS) {
    if (!morphTargetNames.has(clean(muscleMorph))) {
      issues.push({
        level: 'error',
        code: `missing-muscle-morph:${muscleMorph}`,
        message: `Avatar V2 must include the authored muscle definition target: ${muscleMorph}.`,
      });
    }
  }
  for (const expression of AVATAR_V2_REQUIRED_EXPRESSIONS) {
    if (!hasExpression(morphTargets, expression)) {
      issues.push({
        level: lod <= 1 ? 'error' : 'warning',
        code: `missing-expression:${expression}`,
        message: `Facial expression target is missing: ${expression}.`,
      });
    }
  }

  if (lod <= 1) {
    const available = new Set(morphTargets.map(clean));
    for (const expression of AVATAR_V2_RECOMMENDED_EXPRESSIONS) {
      if (![expression].map(clean).some(name => available.has(name))) {
        issues.push({
          level: 'warning',
          code: `missing-performance-expression:${expression}`,
          message: `Recommended singing expression target is missing: ${expression}.`,
        });
      }
    }
    const requiredMuscles = new Set(AVATAR_V2_REQUIRED_MUSCLE_MORPHS.map(clean));
    for (const morph of AVATAR_V2_CUSTOMIZATION_MORPHS) {
      if (requiredMuscles.has(clean(morph))) continue;
      if (!available.has(clean(morph))) {
        issues.push({
          level: 'warning',
          code: `missing-customization-morph:${morph}`,
          message: `Recommended Avatar Designer shape target is missing: ${morph}.`,
        });
      }
    }
    for (const corrective of AVATAR_V2_POSE_CORRECTIVES) {
      if (!available.has(clean(corrective))) {
        issues.push({
          level: 'error',
          code: `missing-pose-corrective:${corrective}`,
          message: `LOD${lod} requires close-up joint deformation target: ${corrective}.`,
        });
      }
    }
  }

  const materials = collectMaterialNames(scene);
  if (lod <= 1) {
    for (const role of ['skin', 'eyes'] as const) {
      if (!hasMaterialRole(materials, role)) {
        issues.push({
          level: 'error',
          code: `missing-material-role:${role}`,
          message: `LOD${lod} needs a named ${role} material for close-up physical shading.`,
        });
      }
    }
  }
  if (lod === 0) {
    for (const role of ['cornea', 'teeth', 'tongue', 'mouthInterior'] as const) {
      if (!hasMaterialRole(materials, role)) {
        issues.push({
          level: 'error',
          code: `missing-material-role:${role}`,
          message: role === 'cornea'
            ? 'LOD0 needs a separate cornea/eye-shell material for reflective eye depth in close-ups.'
            : role === 'mouthInterior'
              ? 'LOD0 needs a separate mouth-interior material so open-mouth singing never exposes a hollow head.'
              : `LOD0 needs a separate ${role} material/mesh for singing close-ups.`,
        });
      }
    }
  } else if (lod === 1) {
    for (const role of ['cornea', 'teeth', 'tongue', 'mouthInterior'] as const) {
      if (!hasMaterialRole(materials, role)) {
        issues.push({
          level: 'warning',
          code: `missing-material-role:${role}`,
          message: `LOD1 should retain separate ${role} geometry/material for close stage shots.`,
        });
      }
    }
  }

  const budget = AVATAR_V2_BUDGETS[lod];
  if (triangles > budget.maxTriangles) {
    issues.push({ level: 'error', code: 'triangle-budget', message: `LOD${lod} has ${triangles.toLocaleString()} triangles; budget is ${budget.maxTriangles.toLocaleString()}.` });
  }
  if (vertices > budget.maxVertices) {
    issues.push({ level: 'error', code: 'vertex-budget', message: `LOD${lod} has ${vertices.toLocaleString()} vertices; budget is ${budget.maxVertices.toLocaleString()}.` });
  }
  if (bones.size > budget.maxBones) {
    issues.push({ level: 'error', code: 'bone-budget', message: `LOD${lod} has ${bones.size} bones; budget is ${budget.maxBones}.` });
  }

  const metadata = (scene.userData?.rockmundoAvatarV2 ?? {}) as Record<string, unknown>;
  if (metadata.version !== '2.0') {
    issues.push({ level: 'warning', code: 'metadata-version', message: 'Root metadata rockmundoAvatarV2.version should be 2.0.' });
  }
  if (metadata.frame && metadata.frame !== frame) {
    issues.push({ level: 'error', code: 'frame-mismatch', message: `Asset metadata frame ${String(metadata.frame)} does not match requested ${frame} frame.` });
  }

  return {
    valid: !issues.some(issue => issue.level === 'error'),
    frame,
    lod,
    triangles,
    vertices,
    bones: bones.size,
    skinnedMeshes,
    morphTargets,
    boneMap,
    issues,
  };
}
