import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

test('inventory includes known public and festival routes without claiming passes',()=>{
  execFileSync(process.execPath,['scripts/qa/inventory-routes.mjs']);
  execFileSync(process.execPath,['scripts/qa/generate-test-matrix.mjs']);
  const inv=JSON.parse(fs.readFileSync('qa/route-inventory.json','utf8'));
  const matrix=JSON.parse(fs.readFileSync('qa/test-matrix.json','utf8'));
  const paths=new Set(inv.routes.map(x=>x.path));
  assert.ok(paths.has('/world/festivals'));
  assert.ok(paths.has('/festival-company/:festivalCompanyId/editions/:editionId/settlement'));
  assert.equal(paths.size,inv.routeCount);
  assert.equal(matrix.caseCount,inv.routeCount*7);
  assert.ok(inv.routes.every(x=>x.status==='not-tested'));
  assert.ok(matrix.cases.every(x=>x.status==='not-tested' && x.issue===null));
  assert.ok(matrix.cases.every(x=>paths.has(x.route)));
});
