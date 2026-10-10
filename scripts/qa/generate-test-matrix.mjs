#!/usr/bin/env node
// Generate an untested checklist from the static inventory, never fabricated passes.
import fs from 'node:fs';
const file='qa/route-inventory.json';
if (!fs.existsSync(file)) { console.error('Run node scripts/qa/inventory-routes.mjs first'); process.exit(1); }
const inventory=JSON.parse(fs.readFileSync(file,'utf8'));
const cases=[
  ['load','Page loads without runtime errors'],
  ['navigation','Navigation and redirects lead to the intended page'],
  ['actions','Primary actions and forms work'],
  ['states','Empty, loading and error states are understandable'],
  ['access','Authentication and role restrictions are enforced'],
  ['mobile','Mobile layout and controls are usable'],
  ['persistence','Changes persist and refresh correctly']
];
const rows=inventory.routes.flatMap(route=>cases.map(([id,expectation])=>({
  id:route.path+'#'+id,route:route.path,check:id,expectation,
  status:'not-tested',environment:null,commit:null,evidence:null,issue:null
})));
fs.writeFileSync('qa/test-matrix.json',JSON.stringify({
  generatedAt:new Date().toISOString(),caseCount:rows.length,
  warning:'Template only. Review applicability and expand gameplay, finance, security, DB and background-job checks manually.',
  cases:rows
},null,2)+'\n');
console.log('Generated '+rows.length+' NOT TESTED checklist rows');
