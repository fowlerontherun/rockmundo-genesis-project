#!/usr/bin/env node
/**
 * Phase 3 manifest coverage audit. This is intentionally separate from the
 * GLB validator: a parseable blockout is not an approved production garment.
 * Default: report gaps without failing an authoring-only checkout.
 * --strict: fail until all 15 designs have complete approved manifest entries.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'public/avatar-v2/clothing/manifest.json');
const strict = process.argv.includes('--strict');
const expected = [
  'clothing.starter.logo-tee',
  'clothing.starter.plain-black-tee',
  'clothing.starter.plain-white-tee',
  'clothing.starter.vintage-charcoal-tee',
  'clothing.starter.black-straight-jeans',
  'clothing.starter.blue-straight-jeans',
  'clothing.starter.dark-slim-jeans',
  'clothing.starter.black-boots',
  'clothing.starter.brown-boots',
  'clothing.starter.canvas-trainers',
  'clothing.punk.combat-boots',
  'clothing.punk.double-eyelet-belt',
  'clothing.punk.patch-jacket',
  'clothing.punk.safety-pin-tee',
  'clothing.punk.studded-wrist-cuffs',
];
const frames = ['masculine', 'feminine'];
const lods = ['lod0', 'lod1', 'lod2', 'lod3'];
const errors = [];
if (!fs.existsSync(manifestPath)) {
  console.error('[avatar-v2/phase3] Missing manifest:', manifestPath);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const entries = manifest.items ?? [];
const byKey = new Map();
for (const item of entries) {
  if (byKey.has(item.itemKey)) errors.push(`Duplicate itemKey: ${item.itemKey}`);
  byKey.set(item.itemKey, item);
}
for (const key of expected) {
  const item = byKey.get(key);
  if (!item) {
    errors.push(`Missing staged design: ${key}`);
    continue;
  }
  const paths = new Set();
  for (const frame of frames) {
    for (const lod of lods) {
      const asset = item.frames?.[frame]?.[lod];
      if (!asset) {
        errors.push(`${key}: missing ${frame} ${lod}`);
        continue;
      }
      if (!new RegExp(`^avatar-v2/clothing/${frame}/[a-z0-9._/-]+-${lod}\\.glb$`, 'i').test(asset)
          || asset.split('/').includes('..')) {
        errors.push(`${key}: invalid ${frame} ${lod} path: ${asset}`);
      }
      if (paths.has(asset)) errors.push(`${key}: reused frame/LOD asset: ${asset}`);
      paths.add(asset);
      if (item.status === 'validated' && !fs.existsSync(path.join(root, 'public', asset))) {
        errors.push(`${key}: validated asset does not exist: ${asset}`);
      }
    }
  }
  if (item.status !== 'validated') errors.push(`${key}: not production validated (${item.status})`);
}
for (const item of entries) {
  if (!expected.includes(item.itemKey)) {
    console.warn(`[avatar-v2/phase3] Additional manifest item outside 15 staged designs: ${item.itemKey}`);
  }
}
console.log(`[avatar-v2/phase3] ${expected.length - expected.filter(key => !byKey.has(key)).length}/15 designs represented; ${entries.filter(item => expected.includes(item.itemKey) && item.status === 'validated').length}/15 marked validated; ${errors.length} outstanding coverage/approval gaps.`);
for (const error of errors) console.log(`[avatar-v2/phase3] GAP: ${error}`);
if (strict && errors.length) process.exitCode = 1;
