import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

test('inventory includes known public and festival routes without claiming passes',()=>{
  execFileSync(process.execPath,['scripts/qa/inventory-routes.mjs']);
  execFileSync(process.execPath,['scripts/qa/generate-test-matrix.mjs']);
  execFileSync(process.execPath,['scripts/qa/check-navigation.mjs']);
  execFileSync(process.execPath,['scripts/qa/inventory-backend.mjs']);
  const inv=JSON.parse(fs.readFileSync('qa/route-inventory.json','utf8'));
  const matrix=JSON.parse(fs.readFileSync('qa/test-matrix.json','utf8'));
  const navigation=JSON.parse(fs.readFileSync('qa/navigation-review.json','utf8'));
  const backend=JSON.parse(fs.readFileSync('qa/backend-inventory.json','utf8'));
  const paths=new Set(inv.routes.map(x=>x.path));
  assert.ok(paths.has('/world/festivals'));
  assert.ok(paths.has('/admin/festivals/:festivalCompanyId/editions/:editionId'));
  assert.ok(paths.has('/festival-company/:festivalCompanyId/editions/:editionId/schedule'));
  assert.ok(paths.has('/festival-company/:festivalCompanyId/editions/:editionId/settlement'));
  assert.equal(paths.size,inv.routeCount);
  assert.equal(matrix.caseCount,inv.routeCount*7);
  assert.ok(inv.routes.every(x=>x.status==='not-tested'));
  assert.ok(matrix.cases.every(x=>x.status==='not-tested' && x.issue===null));
  assert.ok(matrix.cases.every(x=>paths.has(x.route)));
  assert.equal(navigation.candidateCount,navigation.candidates.length);
  assert.ok(navigation.candidates.every(x=>x.status==='requires-review'));
  assert.ok(navigation.candidates.every(x=>paths.has(x.path)));
  assert.equal(backend.surfaceCount,backend.surfaces.length);
  assert.ok(backend.surfaces.every(x=>x.status==='not-tested'));
  assert.ok(backend.surfaces.every(x=>['edge-function','migration','database-test'].includes(x.type)));
});

test('priority gameplay journeys are uniquely identified and never pre-marked as passed',()=>{
  const data=JSON.parse(fs.readFileSync('qa/priority-journeys.json','utf8'));
  const ids=data.journeys.map(j=>j.id);
  assert.equal(new Set(ids).size,ids.length);
  assert.ok(data.journeys.length>=8);
  assert.ok(data.journeys.every(j=>j.status==='not-tested'));
  assert.ok(data.journeys.every(j=>['P0','P1','P2','P3','P4'].includes(j.priority)));
  assert.ok(data.journeys.every(j=>j.checks.length>0 && j.roles.length>0));
});
