import * as T from 'three';
import type { PlayerAppearance } from '../appearance';

export type AvatarV2Frame = PlayerAppearance['body']['frame'];
export type AvatarV2Lod = 0 | 1 | 2 | 3;

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

const BONE_ALIASES: Record<AvatarV2Bone, string[]> = {
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
  leftThumb: ['leftThumbProximal', 'leftHandThumb1', 'thumb_01_l', 'mixamorigLeftHandThumb1'],
  leftIndex: ['leftIndexProximal', 'leftHandIndex1', 'index_01_l', 'mixamorigLeftHandIndex1'],
  leftMiddle: ['leftMiddleProximal', 'leftHandMiddle1', 'middle_01_l', 'mixamorigLeftHandMiddle1'],
  leftRing: ['leftRingProximal', 'leftHandRing1', 'ring_01_l', 'mixamorigLeftHandRing1'],
  leftLittle: ['leftLittleProximal', 'leftHandPinky1', 'pinky_01_l', 'mixamorigLeftHandPinky1'],
  rightThumb: ['rightThumbProximal', 'rightHandThumb1', 'thumb_01_r', 'mixamorigRightHandThumb1'],
  rightIndex: ['rightIndexProximal', 'rightHandIndex1', 'index_01_r', 'mixamorigRightHandIndex1'],
  rightMiddle: ['rightMiddleProximal', 'rightHandMiddle1', 'middle_01_r', 'mixamorigRightHandMiddle1'],
  rightRing: ['rightRingProximal', 'rightHandRing1', 'ring_01_r', 'mixamorigRightHandRing1'],
  rightLittle: ['rightLittleProximal', 'rightHandPinky1', 'pinky_01_r', 'mixamorigRightHandPinky1'],
} as const;

export const AVATAR_V2_RECOMMENDED_EXPRESSIONS = [
  'visemeAA', 'visemeEE', 'visemeIH', 'visemeOH', 'visemeOU',
  'mouthFunnel', 'mouthPucker',
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

const clean = (value: string) => value.replace(/[^a-z0-9]/gi, '').toLowerCase();

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
    const candidates = [canonical, ...BONE_ALIASES[canonical]].map(clean);
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

function hasMaterialRole(names: string[], role: 'skin' | 'eyes' | 'teeth' | 'tongue') {
  const patterns = {
    skin: /rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])/i,
    eyes: /rmv2[_-]?eyes|(^|[_-])(eye|eyes|iris|cornea)($|[_-])/i,
    teeth: /rmv2[_-]?teeth|teeth/i,
    tongue: /rmv2[_-]?tongue|tongue/i,
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
  }

  const morphTargets = collectMorphTargets(scene);
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
    for (const expression of AVATAR_V2_RECOMMENDED_EXPRESSIONS) {
      const available = new Set(morphTargets.map(clean));
      if (![expression].map(clean).some(name => available.has(name))) {
        issues.push({
          level: 'warning',
          code: `missing-performance-expression:${expression}`,
          message: `Recommended singing expression target is missing: ${expression}.`,
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
    for (const role of ['teeth', 'tongue'] as const) {
      if (!hasMaterialRole(materials, role)) {
        issues.push({
          level: 'error',
          code: `missing-material-role:${role}`,
          message: `LOD0 needs a separate ${role} material/mesh for singing close-ups.`,
        });
      }
    }
  } else if (lod === 1) {
    for (const role of ['teeth', 'tongue'] as const) {
      if (!hasMaterialRole(materials, role)) {
        issues.push({
          level: 'warning',
          code: `missing-material-role:${role}`,
          message: `LOD1 should retain separate ${role} geometry for close stage shots.`,
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
