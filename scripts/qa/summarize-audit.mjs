#!/usr/bin/env node
// Read-only audit summary. Never converts discovery into test passes.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const routes=read('qa/route-inventory.json');
const matrix=read('qa/test-matrix.json');
const navigation=read('qa/navigation-review.json');
const backend=read('qa/backend-inventory.json');
const journeys=read('qa/priority-journeys.json');
const counts=items=>items.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{});
const result={
  generatedAt:new Date().toISOString(),
  routeCandidates:routes.routeCount,
  routeStatuses:counts(routes.routes),
  checklistCases:matrix.caseCount,
  checklistStatuses:counts(matrix.cases),
  navigationCandidates:navigation.candidateCount,
  backendSurfaces:backend.surfaceCount,
  backendByType:backend.counts,
  priorityJourneys:journeys.journeys.length,
  journeyStatuses:counts(journeys.journeys),
  confirmedBugs:0,
  caveat:'Static source discovery only. No browser or backend behavior has been executed; confirmedBugs reflects this discovery run, not all GitHub issues.'
};
fs.writeFileSync('qa/audit-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
