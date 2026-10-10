#!/usr/bin/env node
// Reconcile risk-led journeys with discovered routes. Unmatched routes are review items, not defects.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const routes=read('qa/route-inventory.json').routes;
const journeys=read('qa/priority-journeys.json').journeys;
const matches=(pattern,target)=>{
  const a=pattern.split('/'),b=target.split('/');
  return a.length===b.length && a.every((part,i)=>part===b[i]||part.startsWith(':')||b[i].startsWith(':'));
};
const result=journeys.map(j=>({
  id:j.id,priority:j.priority,status:j.status,
  routes:j.routes.map(route=>{
    const matching=routes.filter(r=>matches(r.path,route));
    return {route,foundInStaticInventory:matching.length>0,
      discoveryKinds:[...new Set(matching.flatMap(r=>r.discoveryKinds))],
      status:matching.length?'discovered-not-tested':'requires-route-review'};
  })
}));
const missing=result.flatMap(j=>j.routes.filter(r=>!r.foundInStaticInventory).map(r=>({journey:j.id,route:r.route})));
fs.writeFileSync('qa/journey-route-review.json',JSON.stringify({
  generatedAt:new Date().toISOString(),journeys:result.length,unmatchedRouteReferences:missing.length,
  warning:'Unmatched paths are candidates for investigation, not proof of a missing page or broken feature.',
  missing,results:result
},null,2)+'\n');
console.log('Priority journeys:',result.length,'route references requiring review:',missing.length);
