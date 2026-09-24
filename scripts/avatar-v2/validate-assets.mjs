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

const recommendedExpressions = [
  'visemeAA','visemeEE','visemeIH','visemeOH','visemeOU',
  'mouthFunnel','mouthPucker',
  'eyeSquintLeft','eyeSquintRight',
  'browInnerUp','browDownLeft','browDownRight',
  'cheekSquintLeft','cheekSquintRight',
  'mouthStretchLeft','mouthStretchRight',
];
const customizationMorphs = ['bodySlim','bodyBroad','faceOval','faceAngular','faceSoft','faceWide'];
const poseCorrectives = [
  'poseShoulderLeft','poseShoulderRight',
  'poseElbowLeft','poseElbowRight',
  'poseHipLeft','poseHipRight',
  'poseKneeLeft','poseKneeRight',
];
const requiredBodyRegions = ['torso','upper-arms','lower-arms','hands','hips','upper-legs','lower-legs','feet'];

const expressionAliases = {
  blinkLeft: ['blinkleft','blink_l','eyeBlinkLeft','eye_blink_l'],
  blinkRight: ['blinkright','blink_r','eyeBlinkRight','eye_blink_r'],
  jawOpen: ['jawopen','jaw_open','mouthOpen','mouth_open'],
  mouthSmile: ['mouthsmile','mouth_smile','smile','mouthSmileLeft'],
};

const clean = value => String(value ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();

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

  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      triangles += primitiveTriangles(gltf, primitive);
      vertices += accessorCount(gltf, primitive.attributes?.POSITION);
    }
    for (const name of mesh.extras?.targetNames ?? []) morphTargets.add(name);
  }

  const skinnedMeshIndexes = new Set(
    (gltf.nodes ?? []).filter(node => node.skin !== undefined && node.mesh !== undefined).map(node => node.mesh),
  );
  skinnedMeshes = skinnedMeshIndexes.size;

  const jointIndexes = new Set();
  for (const skin of gltf.skins ?? []) for (const joint of skin.joints ?? []) jointIndexes.add(joint);
  const jointNames = [...jointIndexes].map(index => gltf.nodes?.[index]?.name).filter(Boolean);

  const bodyRegions = new Set();
  const unskinnedBodyRegions = new Set();
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
    for (const region of matched) {
      bodyRegions.add(region);
      if (node.skin == null) unskinnedBodyRegions.add(region);
    }
  }

  return {
    triangles,
    vertices,
    bones: jointIndexes.size,
    skinnedMeshes,
    jointNames,
    morphTargets: [...morphTargets],
    materialNames: (gltf.materials ?? []).map(material => material?.name).filter(Boolean),
    bodyRegions: [...bodyRegions],
    unskinnedBodyRegions: [...unskinnedBodyRegions],
  };
}

function containsAlias(names, aliases) {
  const available = new Set(names.map(clean));
  return aliases.map(clean).some(alias => available.has(alias));
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
    for (const region of requiredBodyRegions) {
      if (!report.bodyRegions.includes(region)) errors.push(`Missing garment-occlusion body region: ${region}`);
      else if (report.unskinnedBodyRegions.includes(region)) errors.push(`Garment-occlusion body region is not skinned: ${region}`);
    }
  }

  for (const [expression, aliases] of Object.entries(expressionAliases)) {
    if (!containsAlias(report.morphTargets, [expression, ...aliases])) {
      const message = `Missing expression target: ${expression}`;
      if (entry.lod <= 1) errors.push(message);
      else warnings.push(message);
    }
  }

  if (entry.lod <= 1) {
    for (const expression of recommendedExpressions) {
      if (!containsAlias(report.morphTargets, [expression])) warnings.push(`Missing recommended singing expression: ${expression}`);
    }
    for (const morph of customizationMorphs) {
      if (!containsAlias(report.morphTargets, [morph])) warnings.push(`Missing Avatar Designer customization morph: ${morph}`);
    }
    for (const corrective of poseCorrectives) {
      if (!containsAlias(report.morphTargets, [corrective])) errors.push(`Missing required close-up pose corrective: ${corrective}`);
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
