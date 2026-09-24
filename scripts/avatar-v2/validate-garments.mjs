import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, 'public');
const MANIFEST = path.join(ROOT, 'public', 'avatar-v2', 'clothing', 'manifest.json');
const VALID_STATUSES = new Set(['planned', 'asset_ready', 'validated', 'blocked']);
const VALID_REGIONS = new Set(['torso','upper-arms','lower-arms','hands','hips','upper-legs','lower-legs','feet']);
const REQUIRED_FIT_MORPHS = ['bodySlim','bodyBroad','muscleToned','muscleAthletic','muscleMuscular','muscleBodybuilder'];
const SHAPED_BODY_REGIONS = new Set(['torso','upper-arms','lower-arms','hips','upper-legs','lower-legs']);

let failed = false;
const fail = message => {
  failed = true;
  console.error(`[avatar-v2/garments] ERROR: ${message}`);
};
const warn = message => console.warn(`[avatar-v2/garments] WARN: ${message}`);

function readGlbJson(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 20) throw new Error('File is too small to be a GLB.');
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('Invalid GLB magic.');
  if (bytes.readUInt32LE(4) !== 2) throw new Error('Only GLB 2.0 is supported.');
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error('GLB length header does not match file size.');

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (offset + length > bytes.length) throw new Error('GLB chunk exceeds file size.');
    if (type === 0x4e4f534a) {
      return JSON.parse(bytes.subarray(offset, offset + length).toString('utf8').replace(/\0+$/g, '').trim());
    }
    offset += length;
  }
  throw new Error('GLB JSON chunk is missing.');
}

function accessorCount(gltf, index) {
  return index == null ? 0 : Number(gltf.accessors?.[index]?.count ?? 0);
}

function primitiveTriangles(gltf, primitive) {
  const count = primitive.indices != null
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
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      triangles += primitiveTriangles(gltf, primitive);
      vertices += accessorCount(gltf, primitive.attributes?.POSITION);
    }
  }

  const meshNodes = (gltf.nodes ?? []).filter(node => node.mesh != null);
  const unskinnedMeshNodes = meshNodes.filter(node => node.skin == null);
  const negativeScaleNodes = (gltf.nodes ?? []).filter(
    node => Array.isArray(node.scale) && node.scale.some(value => Number(value) <= 0),
  );

  const morphNames = new Set();
  for (const mesh of gltf.meshes ?? []) {
    for (const name of mesh.extras?.targetNames ?? []) {
      if (typeof name === 'string' && name.trim()) morphNames.add(name.trim());
    }
  }

  return {
    triangles,
    vertices,
    meshNodes: meshNodes.length,
    unskinnedMeshNodes,
    negativeScaleNodes,
    materialNames: (gltf.materials ?? []).map(material => material?.name).filter(Boolean),
    morphNames,
  };
}

function validateManifestItem(item) {
  if (!item || typeof item !== 'object') return ['Entry is not an object.'];
  const errors = [];
  if (!item.itemKey || typeof item.itemKey !== 'string') errors.push('itemKey is required.');
  if (!['top','bottom','footwear'].includes(item.slot)) errors.push(`Unsupported slot: ${String(item.slot)}.`);
  if (!VALID_STATUSES.has(item.status)) errors.push(`Unsupported status: ${String(item.status)}.`);
  if (!Array.isArray(item.occludeBodyRegions) || !item.occludeBodyRegions.length) {
    errors.push('At least one body occlusion region is required.');
  } else {
    for (const region of item.occludeBodyRegions) {
      if (!VALID_REGIONS.has(region)) errors.push(`Unknown body occlusion region: ${region}.`);
    }
  }
  if (item.colourMode === 'zones') {
    const main = item.materialZones?.main;
    if (!Array.isArray(main) || !main.length) errors.push('colourMode=zones requires materialZones.main.');
  }

  for (const frame of ['masculine','feminine']) {
    const assets = item.frames?.[frame];
    if (!assets || typeof assets !== 'object') {
      errors.push(`Missing ${frame} frame mapping.`);
      continue;
    }
    for (const [lodName, asset] of Object.entries(assets)) {
      if (!/^lod[0-3]$/.test(lodName)) {
        errors.push(`Unknown LOD key ${frame}.${lodName}.`);
        continue;
      }
      if (typeof asset !== 'string' || !/^avatar-v2\/clothing\/[a-z0-9._/-]+\.glb$/i.test(asset) || asset.includes('..')) {
        errors.push(`Unsafe garment path: ${String(asset)}.`);
      }
    }
  }
  return errors;
}

function validateAsset(gltf, item, frame, lod, budget) {
  const report = inspect(gltf);
  const errors = [];
  const warnings = [];

  if (!report.meshNodes) errors.push('No garment meshes found.');
  if (report.unskinnedMeshNodes.length) {
    errors.push(
      `${report.unskinnedMeshNodes.length} unskinned mesh node(s) found; every visible detail must be skin/bone weighted to prevent floating.`,
    );
  }
  if (report.negativeScaleNodes.length) errors.push(`${report.negativeScaleNodes.length} node(s) use zero/negative scale.`);
  if (report.triangles > budget.maxTriangles) errors.push(`Triangle budget exceeded: ${report.triangles} > ${budget.maxTriangles}.`);
  if (report.vertices > budget.maxVertices) errors.push(`Vertex budget exceeded: ${report.vertices} > ${budget.maxVertices}.`);

  const materialNames = new Set(report.materialNames);
  if (item.colourMode === 'zones') {
    for (const name of item.materialZones?.main ?? []) {
      if (!materialNames.has(name)) errors.push(`Main colour-zone material is missing: ${name}.`);
    }
    for (const name of item.materialZones?.trim ?? []) {
      if (!materialNames.has(name)) warnings.push(`Trim colour-zone material is missing: ${name}.`);
    }
  }

  const skinCount = (gltf.skins ?? []).length;
  if (!skinCount) errors.push('No glTF skin is present.');
  if (skinCount > 1) warnings.push(`Garment exports ${skinCount} skins; one shared humanoid skin is preferred.`);

  const needsBodyFitMorphs = (item.occludeBodyRegions ?? []).some(region => SHAPED_BODY_REGIONS.has(region));
  if (needsBodyFitMorphs) {
    for (const morph of REQUIRED_FIT_MORPHS) {
      if (!report.morphNames.has(morph)) {
        errors.push(`Required body-fit morph is missing: ${morph}.`);
      }
    }
  }

  return { ...report, errors, warnings, frame, lod };
}

if (!fs.existsSync(MANIFEST)) {
  fail(`Garment manifest missing: ${MANIFEST}`);
} else {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (manifest.schema !== 'rockmundo.avatar-v2-garments') fail('Unexpected garment manifest schema.');
  if (manifest.version !== 1) fail('Garment manifest version must be 1.');

  for (const item of manifest.items ?? []) {
    for (const error of validateManifestItem(item)) fail(`${item?.itemKey ?? 'unknown'}: ${error}`);

    for (const frame of ['masculine','feminine']) {
      for (const [lodName, asset] of Object.entries(item.frames?.[frame] ?? {})) {
        const lod = Number(lodName.replace('lod',''));
        const budget = manifest.budgets?.[lodName];
        if (!budget) {
          fail(`${item.itemKey} ${frame} ${lodName}: budget missing.`);
          continue;
        }

        const file = path.join(ASSET_ROOT, String(asset));
        const mustExist = item.status === 'asset_ready' || item.status === 'validated';
        if (!fs.existsSync(file)) {
          if (mustExist) fail(`${item.itemKey} ${frame} ${lodName} is ${item.status} but file is missing: ${asset}`);
          continue;
        }

        try {
          const report = validateAsset(readGlbJson(file), item, frame, lod, budget);
          console.log(
            `[avatar-v2/garments] ${item.itemKey} ${frame} LOD${lod}: ` +
            `${report.triangles.toLocaleString()} tris, ${report.vertices.toLocaleString()} vertices`,
          );
          report.warnings.forEach(message => warn(`${item.itemKey} ${frame} LOD${lod}: ${message}`));
          report.errors.forEach(message => fail(`${item.itemKey} ${frame} LOD${lod}: ${message}`));
        } catch (error) {
          fail(`${item.itemKey} ${frame} LOD${lod}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  if (!failed) {
    console.log('[avatar-v2/garments] Manifest and all present garment candidates pass automated validation.');
  }
}

if (failed) process.exitCode = 1;
