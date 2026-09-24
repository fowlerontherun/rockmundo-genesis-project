import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'public/avatar-v2/source-provenance.json');
const source = JSON.parse(fs.readFileSync(file, 'utf8'));

const expected = {
  schema: 'rockmundo.avatar-v2-source-provenance',
  version: 1,
  sourceId: 'blender-human-base-meshes-v1.4.1',
  bundleVersion: '1.4.1',
  license: 'CC0-1.0',
  expectedArchiveBytes: 50643039,
  minimumBlenderVersion: '4.2',
  usage: 'authoring-source-only',
};

const failures = [];
for (const [key, value] of Object.entries(expected)) {
  if (source[key] !== value) failures.push(`${key}: expected ${JSON.stringify(value)}, got ${JSON.stringify(source[key])}`);
}

if (
  typeof source.downloadUrl !== 'string'
  || !/^https:\/\/download\.blender\.org\/demo\/asset-bundles\/human-base-meshes\/human-base-meshes-bundle-v1\.4\.1\.zip$/.test(source.downloadUrl)
) {
  failures.push('downloadUrl must remain pinned to the official Blender v1.4.1 bundle.');
}

if (!Array.isArray(source.notes) || source.notes.length < 2) {
  failures.push('source provenance must explain authoring-only use and validation requirements.');
}

if (
  source.recommendedCollections?.masculine !== 'Body Male - Stylized'
  || source.recommendedCollections?.feminine !== 'Body Female - Stylized'
) {
  failures.push('recommendedCollections must remain pinned to the reviewed Blender stylized male/female bodies.');
}

if (failures.length) {
  console.error('Avatar V2 source provenance check failed:');
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Avatar V2 authoring source pinned: ${source.name} ${source.bundleVersion} (${source.license})`);
