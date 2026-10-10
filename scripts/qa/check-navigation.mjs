#!/usr/bin/env node
// Candidate navigation gaps only; route matching is approximate, not proof of a broken link.
import fs from 'node:fs';
const inventory=JSON.parse(fs.readFileSync('qa/route-inventory.json','utf8'));
const routes=inventory.routes;
// Festival registry definitions alone do not prove the route is mounted in JSX.
const registered=routes.filter(r=>r.discoveryKinds.some(k=>k==='jsx-route'||k==='jsx-festival-route'));
const nav=routes.filter(r=>r.discoveryKinds.some(k=>k.startsWith('navigation')));
const normalize=p=>p.replace(/\/+$/,'')||'/';
const match=(pattern,url)=>{
  const a=normalize(pattern).split('/'),b=normalize(url).split('/');
  return a.length===b.length && a.every((part,i)=>part.startsWith(':')||part==='*'||part===b[i]);
};
const candidates=nav.filter(r=>!registered.some(x=>match(x.path,r.path))).map(r=>({
  path:r.path,sources:r.sources,status:'requires-review',
  reason:'No direct static route match; may be a redirect, nested route, dynamic expression or intentionally external navigation'
}));
fs.writeFileSync('qa/navigation-review.json',JSON.stringify({
  generatedAt:new Date().toISOString(),registeredPatterns:registered.length,
  navigationReferences:nav.length,candidateCount:candidates.length,
  warning:'Candidate mismatches are NOT verified bugs. Review nested routes and redirects before filing issues.',
  candidates
},null,2)+'\n');
console.log('Navigation references:',nav.length,'potential gaps:',candidates.length);
