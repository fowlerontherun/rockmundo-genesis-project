import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const validator = fileURLToPath(new URL('../validate-garments.mjs', import.meta.url));
const audit = fileURLToPath(new URL('../audit-phase3-garments.mjs', import.meta.url));
function run(script, items, args = []) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'rmv2-garments-'));
  try {
    const dir = path.join(cwd, 'public/avatar-v2/clothing');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
      schema: 'rockmundo.avatar-v2-garments', version: 1,
      budgets: Object.fromEntries([0,1,2,3].map(n => ['lod'+n, {maxTriangles:25000,maxVertices:32000}])),
      items,
    }));
    return spawnSync(process.execPath, [script, ...args], {cwd, encoding:'utf8'});
  } finally { fs.rmSync(cwd, {recursive:true,force:true}); }
}
function garment(status = 'planned') {
  return {
    itemKey:'clothing.starter.logo-tee', name:'Rockmundo Logo Tee', slot:'top',
    status, occludeBodyRegions:['torso'], colourMode:'zones',
    materialZones:{main:['RMV2_Garment_Main'],trim:[]},
    frames:Object.fromEntries(['masculine','feminine'].map(frame => [frame,
      Object.fromEntries([0,1,2,3].map(lod => ['lod'+lod,
        `avatar-v2/clothing/${frame}/clothing.starter.logo-tee-lod${lod}.glb`]))])),
  };
}
test('planned garments can declare future LOD paths without fake binary files', () => {
  const result=run(validator,[garment()]);
  assert.equal(result.status,0,result.stderr);
});
test('asset_ready cannot pass with a missing feminine LOD3', () => {
  const item=garment('asset_ready');
  delete item.frames.feminine.lod3;
  const result=run(validator,[item]);
  assert.equal(result.status,1);
  assert.match(result.stderr,/requires feminine.lod3/);
});
test('validated cannot reuse a masculine GLB for a feminine frame', () => {
  const item=garment('validated');
  item.frames.feminine.lod0=item.frames.masculine.lod0;
  const result=run(validator,[item]);
  assert.equal(result.status,1);
  assert.match(result.stderr,/mismatched garment path|path reused/);
});
test('accessory blockouts remain allowed but not certified', () => {
  const item=garment('blocked');
  item.itemKey='clothing.punk.studded-wrist-cuffs';
  item.slot='accessory';
  item.occludeBodyRegions=['hands'];
  const result=run(validator,[item]);
  assert.equal(result.status,0,result.stderr);
});
test('Phase 3 report mode does not block work in progress; strict mode does', () => {
  assert.equal(run(audit,[garment()]).status,0);
  assert.equal(run(audit,[garment()],['--strict']).status,1);
});
