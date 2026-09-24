import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, 'public', 'avatar-v2');
const MANIFEST_PATH = path.join(ASSET_ROOT, 'manifest.json');

const budgets = {
  0: { triangles: 55000, vertices: 65000, bones: 96 },
  1: { triangles: 30000, vertices: 38000, bones: 96 },
  2: { triangles: 12000, vertices: 18000, bones: 80 },
  3: { triangles: 5000, vertices: 8000, bones: 64 },
};

const requiredBoneAliases = {
  hips: ['hips','pelvis','root_hips','j_bip_c_hips'],
  spine: ['spine','spine1','spine_01','j_bip_c_spine'],
  chest: ['chest','spine2','spine_02','upperchest','j_bip_c_chest'],
  neck: ['neck','neck1','j_bip_c_neck'],
  head: ['head','j_bip_c_head'],
  leftUpperArm: ['leftupperarm','upperarm_l','left_arm','j_bip_l_upperarm'],
  leftLowerArm: ['leftlowerarm','lowerarm_l','left_forearm','j_bip_l_lowerarm'],
  leftHand: ['lefthand','hand_l','left_hand','j_bip_l_hand'],
  rightUpperArm: ['rightupperarm','upperarm_r','right_arm','j_bip_r_upperarm'],
  rightLowerArm: ['rightlowerarm','lowerarm_r','right_forearm','j_bip_r_lowerarm'],
  rightHand: ['righthand','hand_r','right_hand','j_bip_r_hand'],
  leftUpperLeg: ['leftupperleg','thigh_l','left_thigh','j_bip_l_upperleg'],
  leftLowerLeg: ['leftlowerleg','calf_l','left_calf','j_bip_l_lowerleg'],
  leftFoot: ['leftfoot','foot_l','left_foot','j_bip_l_foot'],
  rightUpperLeg: ['rightupperleg','thigh_r','right_thigh','j_bip_r_upperleg'],
  rightLowerLeg: ['rightlowerleg','calf_r','right_calf','j_bip_r_lowerleg'],
  rightFoot: ['rightfoot','foot_r','right_foot','j_bip_r_foot'],
};

const closeupBoneAliases = {
  leftShoulder: ['leftShoulder','shoulder_l','clavicle_l','mixamorigLeftShoulder'],
  rightShoulder: ['rightShoulder','shoulder_r','clavicle_r','mixamorigRightShoulder'],
  leftToes: ['leftToes','toe_l','toebase_l','mixamorigLeftToeBase'],
  rightToes: ['rightToes','toe_r','toebase_r','mixamorigRightToeBase'],
  leftEye: ['Eye.L','leftEye','eye_l','mixamorigLeftEye','j_bip_l_eye'],
  rightEye: ['Eye.R','rightEye','eye_r','mixamorigRightEye','j_bip_r_eye'],
  leftUpperArmTwist: ['UpperArmTwist.L','upperarm_twist_l','upper_arm_twist_l','leftUpperArmTwist'],
  rightUpperArmTwist: ['UpperArmTwist.R','upperarm_twist_r','upper_arm_twist_r','rightUpperArmTwist'],
  leftForearmTwist: ['ForearmTwist.L','forearm_twist_l','lowerarm_twist_l','leftForearmTwist'],
  rightForearmTwist: ['ForearmTwist.R','forearm_twist_r','lowerarm_twist_r','rightForearmTwist'],
  leftThighTwist: ['ThighTwist.L','thigh_twist_l','upperleg_twist_l','leftThighTwist'],
  rightThighTwist: ['ThighTwist.R','thigh_twist_r','upperleg_twist_r','rightThighTwist'],

  leftThumb1: ['Thumb1.L','leftThumbProximal','leftHandThumb1','thumb_01_l','mixamorigLeftHandThumb1'],
  leftThumb2: ['Thumb2.L','leftThumbIntermediate','leftHandThumb2','thumb_02_l','mixamorigLeftHandThumb2'],
  leftThumb3: ['Thumb3.L','leftThumbDistal','leftHandThumb3','thumb_03_l','mixamorigLeftHandThumb3'],
  leftIndex1: ['Index1.L','leftIndexProximal','leftHandIndex1','index_01_l','mixamorigLeftHandIndex1'],
  leftIndex2: ['Index2.L','leftIndexIntermediate','leftHandIndex2','index_02_l','mixamorigLeftHandIndex2'],
  leftIndex3: ['Index3.L','leftIndexDistal','leftHandIndex3','index_03_l','mixamorigLeftHandIndex3'],
  leftMiddle1: ['Middle1.L','leftMiddleProximal','leftHandMiddle1','middle_01_l','mixamorigLeftHandMiddle1'],
  leftMiddle2: ['Middle2.L','leftMiddleIntermediate','leftHandMiddle2','middle_02_l','mixamorigLeftHandMiddle2'],
  leftMiddle3: ['Middle3.L','leftMiddleDistal','leftHandMiddle3','middle_03_l','mixamorigLeftHandMiddle3'],
  leftRing1: ['Ring1.L','leftRingProximal','leftHandRing1','ring_01_l','mixamorigLeftHandRing1'],
  leftRing2: ['Ring2.L','leftRingIntermediate','leftHandRing2','ring_02_l','mixamorigLeftHandRing2'],
  leftRing3: ['Ring3.L','leftRingDistal','leftHandRing3','ring_03_l','mixamorigLeftHandRing3'],
  leftLittle1: ['Pinky1.L','leftLittleProximal','leftHandPinky1','pinky_01_l','mixamorigLeftHandPinky1'],
  leftLittle2: ['Pinky2.L','leftLittleIntermediate','leftHandPinky2','pinky_02_l','mixamorigLeftHandPinky2'],
  leftLittle3: ['Pinky3.L','leftLittleDistal','leftHandPinky3','pinky_03_l','mixamorigLeftHandPinky3'],

  rightThumb1: ['Thumb1.R','rightThumbProximal','rightHandThumb1','thumb_01_r','mixamorigRightHandThumb1'],
  rightThumb2: ['Thumb2.R','rightThumbIntermediate','rightHandThumb2','thumb_02_r','mixamorigRightHandThumb2'],
  rightThumb3: ['Thumb3.R','rightThumbDistal','rightHandThumb3','thumb_03_r','mixamorigRightHandThumb3'],
  rightIndex1: ['Index1.R','rightIndexProximal','rightHandIndex1','index_01_r','mixamorigRightHandIndex1'],
  rightIndex2: ['Index2.R','rightIndexIntermediate','rightHandIndex2','index_02_r','mixamorigRightHandIndex2'],
  rightIndex3: ['Index3.R','rightIndexDistal','rightHandIndex3','index_03_r','mixamorigRightHandIndex3'],
  rightMiddle1: ['Middle1.R','rightMiddleProximal','rightHandMiddle1','middle_01_r','mixamorigRightHandMiddle1'],
  rightMiddle2: ['Middle2.R','rightMiddleIntermediate','rightHandMiddle2','middle_02_r','mixamorigRightHandMiddle2'],
  rightMiddle3: ['Middle3.R','rightMiddleDistal','rightHandMiddle3','middle_03_r','mixamorigRightHandMiddle3'],
  rightRing1: ['Ring1.R','rightRingProximal','rightHandRing1','ring_01_r','mixamorigRightHandRing1'],
  rightRing2: ['Ring2.R','rightRingIntermediate','rightHandRing2','ring_02_r','mixamorigRightHandRing2'],
  rightRing3: ['Ring3.R','rightRingDistal','rightHandRing3','ring_03_r','mixamorigRightHandRing3'],
  rightLittle1: ['Pinky1.R','rightLittleProximal','rightHandPinky1','pinky_01_r','mixamorigRightHandPinky1'],
  rightLittle2: ['Pinky2.R','rightLittleIntermediate','rightHandPinky2','pinky_02_r','mixamorigRightHandPinky2'],
  rightLittle3: ['Pinky3.R','rightLittleDistal','rightHandPinky3','pinky_03_r','mixamorigRightHandPinky3'],
};

const closeupRequiredExpressions = [
  'visemeAA','visemeEE','visemeIH','visemeOH','visemeOU',
  'mouthFunnel','mouthPucker',
  'eyeSquintLeft','eyeSquintRight',
  'browInnerUp','browDownLeft','browDownRight',
  'cheekSquintLeft','cheekSquintRight',
  'mouthStretchLeft','mouthStretchRight',
];
const requiredMuscleMorphs = ['muscleToned','muscleAthletic','muscleMuscular','muscleBodybuilder'];
const customizationMorphs = ['bodySlim','bodyBroad','faceOval','faceAngular','faceSoft','faceWide'];
const poseCorrectives = [
  'poseShoulderLeft','poseShoulderRight',
  'poseElbowLeft','poseElbowRight',
  'poseHipLeft','poseHipRight',
  'poseKneeLeft','poseKneeRight',
];
const MORPH_MIN_DELTA_METRES = 0.0005;
const requiredBodyRegions = ['torso','upper-arms','lower-arms','hands','hips','upper-legs','lower-legs','feet'];

const expressionAliases = {
  blinkLeft: ['blinkleft','blink_l','eyeBlinkLeft','eye_blink_l'],
  blinkRight: ['blinkright','blink_r','eyeBlinkRight','eye_blink_r'],
  jawOpen: ['jawopen','jaw_open','mouthOpen','mouth_open'],
  mouthSmile: ['mouthsmile','mouth_smile','smile','mouthSmileLeft'],
};

const clean = value => String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const skinMaterialPattern = /rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])/i;

function materialBodyRegion(material) {
  if (!material) return null;
  const explicit = String(material.extras?.rockmundoBodyRegion ?? '').toLowerCase();
  if (requiredBodyRegions.includes(explicit)) return explicit;
  const name = clean(material.name ?? '');
  return requiredBodyRegions.find(region => {
    const token = clean(region);
    return name.includes(`rmv2skin${token}`)
      || name.includes(`rmv2bodyregion${token}`)
      || name === `skin${token}`;
  }) ?? null;
}

function fail(message) {
  console.error(`[avatar-v2] ERROR: ${message}`);
  process.exitCode = 1;
}

function readGlbJson(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20) throw new Error('File is too small to be a GLB.');
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('Invalid GLB magic.');
  if (bytes.readUInt32LE(4) !== 2) throw new Error('Only GLB 2.0 is supported.');
  const declared = bytes.readUInt32LE(8);
  if (declared !== bytes.length) throw new Error(`GLB length header ${declared} does not match file size ${bytes.length}.`);

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > bytes.length) throw new Error('GLB chunk exceeds file size.');
    if (type === 0x4e4f534a) {
      const text = bytes.subarray(offset, offset + length).toString('utf8').replace(/\0+$/g, '').trim();
      return JSON.parse(text);
    }
    offset += length;
  }
  throw new Error('GLB JSON chunk is missing.');
}

function accessorCount(gltf, accessorIndex) {
  if (accessorIndex === undefined || accessorIndex === null) return 0;
  return Number(gltf.accessors?.[accessorIndex]?.count ?? 0);
}

function accessorMaxAbs(gltf, accessorIndex) {
  if (accessorIndex === undefined || accessorIndex === null) return null;
  const accessor = gltf.accessors?.[accessorIndex];
  const values = [...(accessor?.min ?? []), ...(accessor?.max ?? [])].map(Number).filter(Number.isFinite);
  return values.length ? Math.max(...values.map(Math.abs)) : null;
}

function primitiveTriangles(gltf, primitive) {
  const count = primitive.indices !== undefined
    ? accessorCount(gltf, primitive.indices)
    : accessorCount(gltf, primitive.attributes?.POSITION);
  const mode = primitive.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function inspect(gltf) {
  let triangles = 0;
  let vertices = 0;
  let skinnedMeshes = 0;
  const morphTargets = new Set();
  const morphTargetDeltas = {};

  for (const mesh of gltf.meshes ?? []) {
    const targetNames = mesh.extras?.targetNames ?? [];
    for (const primitive of mesh.primitives ?? []) {
      triangles += primitiveTriangles(gltf, primitive);
      vertices += accessorCount(gltf, primitive.attributes?.POSITION);
      for (const [targetIndex, target] of (primitive.targets ?? []).entries()) {
        const name = targetNames[targetIndex];
        if (!name || target?.POSITION == null) continue;
        const delta = accessorMaxAbs(gltf, target.POSITION);
        if (delta == null) continue;
        const key = clean(name);
        morphTargetDeltas[key] = Math.max(morphTargetDeltas[key] ?? 0, delta);
      }
    }
    for (const name of targetNames) morphTargets.add(name);
  }

  const skinnedMeshIndexes = new Set(
    (gltf.nodes ?? []).filter(node => node.skin !== undefined && node.mesh !== undefined).map(node => node.mesh),
  );
  skinnedMeshes = skinnedMeshIndexes.size;

  const jointIndexes = new Set();
  for (const skin of gltf.skins ?? []) for (const joint of skin.joints ?? []) jointIndexes.add(joint);
  const jointNames = [...jointIndexes].map(index => gltf.nodes?.[index]?.name).filter(Boolean);
  const parentByNode = new Map();
  (gltf.nodes ?? []).forEach((node, parentIndex) => {
    for (const child of node.children ?? []) parentByNode.set(child, parentIndex);
  });
  const jointAncestors = {};
  for (const index of jointIndexes) {
    const name = gltf.nodes?.[index]?.name;
    if (!name) continue;
    const ancestors = [];
    let parent = parentByNode.get(index);
    while (parent !== undefined) {
      const parentName = gltf.nodes?.[parent]?.name;
      if (parentName) ancestors.push(parentName);
      parent = parentByNode.get(parent);
    }
    jointAncestors[name] = ancestors;
  }

  const bodyRegions = new Set();
  const unskinnedBodyRegions = new Set();
  const bareSkinBodyRegions = new Set();
  for (const node of gltf.nodes ?? []) {
    if (node.mesh == null) continue;
    const matched = new Set();
    const explicit = String(node.extras?.rockmundoBodyRegion ?? '').toLowerCase();
    if (requiredBodyRegions.includes(explicit)) matched.add(explicit);
    const cleanedName = clean(node.name ?? '');
    for (const region of requiredBodyRegions) {
      const cleanedRegion = clean(region);
      if (cleanedName.includes(`rmv2body${cleanedRegion}`) || cleanedName.includes(`body${cleanedRegion}`)) matched.add(region);
    }

    const mesh = gltf.meshes?.[node.mesh];
    const usedMaterials = (mesh?.primitives ?? [])
      .map(primitive => gltf.materials?.[primitive.material])
      .filter(Boolean);
    for (const material of usedMaterials) {
      const region = materialBodyRegion(material);
      if (region) {
        matched.add(region);
        if (skinMaterialPattern.test(material.name ?? '')) bareSkinBodyRegions.add(region);
      }
    }

    for (const region of matched) {
      bodyRegions.add(region);
      if (node.skin == null) unskinnedBodyRegions.add(region);
      if (
        usedMaterials.some(material => skinMaterialPattern.test(material.name ?? ''))
        && (
          explicit === region
          || cleanedName.includes(`rmv2body${clean(region)}`)
          || cleanedName.includes(`body${clean(region)}`)
        )
      ) {
        bareSkinBodyRegions.add(region);
      }
    }
  }

  return {
    triangles,
    vertices,
    bones: jointIndexes.size,
    skinnedMeshes,
    jointNames,
    jointAncestors,
    morphTargets: [...morphTargets],
    morphTargetDeltas,
    materialNames: (gltf.materials ?? []).map(material => material?.name).filter(Boolean),
    bodyRegions: [...bodyRegions],
    unskinnedBodyRegions: [...unskinnedBodyRegions],
    bareSkinBodyRegions: [...bareSkinBodyRegions],
  };
}

function containsAlias(names, aliases) {
  const available = new Set(names.map(clean));
  return aliases.map(clean).some(alias => available.has(alias));
}

function matchingAlias(names, aliases) {
  const wanted = new Set(aliases.map(clean));
  return names.find(name => wanted.has(clean(name)));
}

function morphDelta(report, aliases) {
  const values = aliases
    .map(alias => report.morphTargetDeltas?.[clean(alias)])
    .filter(value => Number.isFinite(value));
  return values.length ? Math.max(...values) : null;
}

function rejectEmptyMorph(report, errors, warnings, label, aliases, isError) {
  const delta = morphDelta(report, aliases);
  if (delta == null || delta >= MORPH_MIN_DELTA_METRES) return;
  const message = `${label} exists but its exported POSITION delta is only ${(delta * 1000).toFixed(3)}mm; zero-effect placeholders are rejected.`;
  (isError ? errors : warnings).push(message);
}

function validateAsset(gltf, entry) {
  const report = inspect(gltf);
  const errors = [];
  const warnings = [];
  const budget = budgets[entry.lod];

  if (!budget) errors.push(`Unsupported LOD: ${entry.lod}`);
  if (!report.skinnedMeshes) errors.push('No skinned meshes found.');
  if (budget && report.triangles > budget.triangles) errors.push(`Triangle budget exceeded: ${report.triangles} > ${budget.triangles}`);
  if (budget && report.vertices > budget.vertices) errors.push(`Vertex budget exceeded: ${report.vertices} > ${budget.vertices}`);
  if (budget && report.bones > budget.bones) errors.push(`Bone budget exceeded: ${report.bones} > ${budget.bones}`);

  for (const [semantic, aliases] of Object.entries(requiredBoneAliases)) {
    if (!containsAlias(report.jointNames, [semantic, ...aliases])) errors.push(`Missing required bone: ${semantic}`);
  }

  if (entry.lod <= 1) {
    for (const [semantic, aliases] of Object.entries(closeupBoneAliases)) {
      if (!containsAlias(report.jointNames, aliases)) errors.push(`Missing close-up articulation bone: ${semantic}`);
    }
    const headName = matchingAlias(report.jointNames, ['head', ...requiredBoneAliases.head]);
    for (const semantic of ['leftEye', 'rightEye']) {
      const eyeName = matchingAlias(report.jointNames, closeupBoneAliases[semantic]);
      if (headName && eyeName && !containsAlias(report.jointAncestors[eyeName] ?? [], [headName])) {
        errors.push(`${semantic} must inherit from the head bone.`);
      }
    }

    const chestName = matchingAlias(report.jointNames, ['chest', ...requiredBoneAliases.chest]);
    for (const [shoulderSemantic, armSemantic] of [
      ['leftShoulder', 'leftUpperArm'],
      ['rightShoulder', 'rightUpperArm'],
    ]) {
      const shoulderName = matchingAlias(report.jointNames, closeupBoneAliases[shoulderSemantic]);
      const armName = matchingAlias(report.jointNames, [armSemantic, ...requiredBoneAliases[armSemantic]]);
      if (shoulderName && chestName && !containsAlias(report.jointAncestors[shoulderName] ?? [], [chestName])) {
        errors.push(`${shoulderSemantic} must inherit from the chest bone.`);
      }
      if (shoulderName && armName && !containsAlias(report.jointAncestors[armName] ?? [], [shoulderName])) {
        errors.push(`${armSemantic} must inherit from ${shoulderSemantic}.`);
      }
    }

    for (const [toeSemantic, footSemantic] of [
      ['leftToes', 'leftFoot'],
      ['rightToes', 'rightFoot'],
    ]) {
      const toeName = matchingAlias(report.jointNames, closeupBoneAliases[toeSemantic]);
      const footName = matchingAlias(report.jointNames, [footSemantic, ...requiredBoneAliases[footSemantic]]);
      if (toeName && footName && !containsAlias(report.jointAncestors[toeName] ?? [], [footName])) {
        errors.push(`${toeSemantic} must inherit from ${footSemantic}.`);
      }
    }

    const twistParents = {
      leftUpperArmTwist: 'leftUpperArm',
      rightUpperArmTwist: 'rightUpperArm',
      leftForearmTwist: 'leftLowerArm',
      rightForearmTwist: 'rightLowerArm',
      leftThighTwist: 'leftUpperLeg',
      rightThighTwist: 'rightUpperLeg',
    };
    for (const [semantic, parentSemantic] of Object.entries(twistParents)) {
      const helperName = matchingAlias(report.jointNames, closeupBoneAliases[semantic]);
      const parentName = matchingAlias(report.jointNames, [parentSemantic, ...requiredBoneAliases[parentSemantic]]);
      if (helperName && parentName && !containsAlias(report.jointAncestors[helperName] ?? [], [parentName])) {
        errors.push(`${semantic} must inherit from ${parentSemantic}.`);
      }
    }
    for (const region of requiredBodyRegions) {
      if (!report.bodyRegions.includes(region)) errors.push(`Missing garment-occlusion body region: ${region}`);
      else if (report.unskinnedBodyRegions.includes(region)) errors.push(`Garment-occlusion body region is not skinned: ${region}`);
      else if (!report.bareSkinBodyRegions.includes(region)) errors.push(`Body region has no skin material: ${region}`);
    }
  }

  for (const morph of requiredMuscleMorphs) {
    if (!containsAlias(report.morphTargets, [morph])) {
      errors.push(`Missing required muscle definition target: ${morph}`);
    } else {
      rejectEmptyMorph(report, errors, warnings, `Muscle target ${morph}`, [morph], true);
    }
  }

  for (const [expression, aliases] of Object.entries(expressionAliases)) {
    const candidates = [expression, ...aliases];
    if (!containsAlias(report.morphTargets, candidates)) {
      const message = `Missing expression target: ${expression}`;
      if (entry.lod <= 1) errors.push(message);
      else warnings.push(message);
    } else {
      rejectEmptyMorph(report, errors, warnings, `Expression ${expression}`, candidates, entry.lod <= 1);
    }
  }

  if (entry.lod <= 1) {
    for (const expression of closeupRequiredExpressions) {
      if (!containsAlias(report.morphTargets, [expression])) errors.push(`Missing required close-up singing expression: ${expression}`);
      else rejectEmptyMorph(report, errors, warnings, `Singing target ${expression}`, [expression], true);
    }
    for (const morph of customizationMorphs) {
      if (!containsAlias(report.morphTargets, [morph])) warnings.push(`Missing Avatar Designer customization morph: ${morph}`);
      else rejectEmptyMorph(report, errors, warnings, `Avatar Designer target ${morph}`, [morph], false);
    }
    for (const corrective of poseCorrectives) {
      if (!containsAlias(report.morphTargets, [corrective])) errors.push(`Missing required close-up pose corrective: ${corrective}`);
      else rejectEmptyMorph(report, errors, warnings, `Pose corrective ${corrective}`, [corrective], true);
    }
  }

  const materialRoles = {
    skin: /rmv2[_-]?skin|(^|[_-])(skin|body|face)($|[_-])/i,
    eyes: /rmv2[_-]?eyes|(^|[_-])(eye|eyes|iris|sclera|cornea)($|[_-])/i,
    cornea: /rmv2[_-]?cornea|cornea|eye[_-]?(shell|surface)|ocular[_-]?shell/i,
    teeth: /rmv2[_-]?teeth|teeth/i,
    tongue: /rmv2[_-]?tongue|tongue/i,
    mouthInterior: /rmv2[_-]?mouth[_-]?(interior|cavity)|oral[_-]?cavity|inner[_-]?mouth/i,
  };
  if (entry.lod <= 1) {
    for (const role of ['skin','eyes']) {
      if (!report.materialNames.some(name => materialRoles[role].test(name))) errors.push(`Missing named close-up material role: ${role}`);
    }
  }
  if (entry.lod === 0) {
    for (const role of ['cornea','teeth','tongue','mouthInterior']) {
      if (!report.materialNames.some(name => materialRoles[role].test(name))) errors.push(`LOD0 missing separate ${role} material/mesh role`);
    }
  } else if (entry.lod === 1) {
    for (const role of ['cornea','teeth','tongue','mouthInterior']) {
      if (!report.materialNames.some(name => materialRoles[role].test(name))) warnings.push(`LOD1 should retain separate ${role} material/mesh role`);
    }
  }

  const negativeScaleNodes = (gltf.nodes ?? []).filter(node => Array.isArray(node.scale) && node.scale.some(value => Number(value) < 0));
  if (negativeScaleNodes.length) errors.push(`${negativeScaleNodes.length} node(s) use negative scale.`);

  return { ...report, errors, warnings };
}

if (!fs.existsSync(MANIFEST_PATH)) {
  fail(`Manifest is missing: ${MANIFEST_PATH}`);
} else {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (manifest.schema !== 'rockmundo.avatar-v2-assets') fail('Unexpected manifest schema.');
  if (manifest.contractVersion !== '2.0') fail('Avatar V2 contractVersion must be 2.0.');

  let checked = 0;
  for (const entry of manifest.assets ?? []) {
    const file = path.join(ASSET_ROOT, entry.file);
    const mustExist = entry.status === 'asset_ready' || entry.status === 'validated';
    if (!fs.existsSync(file)) {
      if (mustExist) fail(`${entry.frame} LOD${entry.lod} is ${entry.status} but file is missing: ${entry.file}`);
      else console.log(`[avatar-v2] ${entry.frame} LOD${entry.lod}: ${entry.status} (asset not present yet)`);
      continue;
    }

    checked += 1;
    try {
      const gltf = readGlbJson(file);
      const report = validateAsset(gltf, entry);
      console.log(
        `[avatar-v2] ${entry.frame} LOD${entry.lod}: ${report.triangles.toLocaleString()} tris, ` +
        `${report.vertices.toLocaleString()} vertices, ${report.bones} bones, ${report.skinnedMeshes} skinned mesh(es)`,
      );
      report.warnings.forEach(message => console.warn(`[avatar-v2] WARN: ${entry.frame} LOD${entry.lod}: ${message}`));
      if (report.errors.length) {
        report.errors.forEach(message => fail(`${entry.frame} LOD${entry.lod}: ${message}`));
      } else if (entry.status === 'validated') {
        console.log(`[avatar-v2] PASS: ${entry.frame} LOD${entry.lod} validated asset meets the automated contract.`);
      } else {
        console.log(`[avatar-v2] PASS: ${entry.frame} LOD${entry.lod} candidate meets the automated contract; visual QA still required.`);
      }
    } catch (error) {
      fail(`${entry.frame} LOD${entry.lod}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!checked) {
    console.log('[avatar-v2] Foundation ready. No candidate GLBs are present yet; planned assets are allowed to be absent.');
  }
}
