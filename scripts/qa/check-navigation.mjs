#!/usr/bin/env node
// Review clickable navigation destinations only; active-tab matchPaths are not links.
import fs from 'node:fs';
const inventory=JSON.parse(fs.readFileSync('qa/route-inventory.json','utf8'));
const registered=inventory.routes.filter(r=>r.discoveryKinds.some(k=>k==='jsx-route'||k==='jsx-festival-route'));
const navigationFiles=['src/config/hubNavigation.ts','src/config/fmNavigation.ts'];
const normalize=p=>(p.split(/[?#]/,1)[0].replace(/\\/+$/,'')||'/');
const match=(pattern,url)=>{
  const a=normalize(pattern).split('/'),b=normalize(url).split('/');
  return a.every((part,i)=>part==='*' ? i===a.length-1 : part.startsWith(':') ? Boolean(b[i]) : part===b[i]) && (a.length===b.length || a[a.length-1]==='*');
};
const destinations=new Map();
for (const file of navigationFiles) {
  const source=fs.readFileSync(file,'utf8')
    .replace(/\\/\\*[\\s\\S]*?\\*\\//g,'').replace(/^\\s*\\/\\/.*$/gm,'');
  // matchPaths are only for active navigation highlighting; strip before extracting path fields.
  const withoutAliases=source.replace(/\\bmatchPaths\\s*:\\s*\\[[\\s\\S]*?\\]/g,'');
  for (const m of withoutAliases.matchAll(/\\b(?:path|rootPath)\\s*:\\s*["'](\\/[^"']*)["']/g)) {
    const path=m[1];
    const existing=destinations.get(path)??new Set();
    existing.add(file);
    destinations.set(path,existing);
  }
}
const candidates=[...destinations].filter(([path])=>!registered.some(r=>match(r.path,path)))
  .map(([path,sources])=>({path,sources:[...sources],status:'requires-review',
    reason:'Clickable navigation destination has no direct static JSX route match; inspect redirects and nested routes'}));
fs.writeFileSync('qa/navigation-review.json',JSON.stringify({
  generatedAt:new Date().toISOString(),registeredPatterns:registered.length,
  navigationReferences:destinations.size,candidateCount:candidates.length,
  scope:'path and rootPath destinations in hub and FM navigation; matchPaths excluded',
  warning:'Candidate mismatches are NOT verified bugs. Review nested routes and redirects before filing issues.',
  candidates
},null,2)+'\\n');
console.log('Navigation destinations:',destinations.size,'potential gaps:',candidates.length);
