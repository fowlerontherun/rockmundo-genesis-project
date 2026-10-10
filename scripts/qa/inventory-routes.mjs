#!/usr/bin/env node
// Static inventory only: never accesses a live site or production database.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.existsSync(path.join(root,p)) ? fs.readFileSync(path.join(root,p),'utf8') : '';
const sources = ['src/App.tsx','src/features/festivals/routes.ts','src/config/hubNavigation.ts','src/config/fmNavigation.ts'];
const routes = new Map();
for (const file of sources) {
  const content = read(file);
  const re = /<Route\b[^>]*?\bpath\s*=\s*["']([^"']+)["']/gs;
  for (const m of content.matchAll(re)) {
    const key = m[1];
    const record = routes.get(key) || { path:key, sources:[], status:'not-tested', notes:'' };
    if (!record.sources.includes(file)) record.sources.push(file);
    routes.set(key,record);
  }
  // Also recognise route config objects using path: '/...'
  const obj = /\bpath\s*:\s*["'](\/[^"']*)["']/g;
  for (const m of content.matchAll(obj)) {
    const record = routes.get(m[1]) || {path:m[1],sources:[],status:'not-tested',notes:''};
    if (!record.sources.includes(file)) record.sources.push(file);
    routes.set(m[1],record);
  }
}
const inventory=[...routes.values()].sort((a,b)=>a.path.localeCompare(b.path));
const output='qa/route-inventory.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({generatedAt:new Date().toISOString(),sourceFiles:sources,routeCount:inventory.length,limitations:['Static extraction only','Nested relative routes require manual resolution','Dynamic routes need fixtures','Feature workflows, edge functions, jobs and role coverage tracked separately'],routes:inventory},null,2)+'\n');
console.log('Wrote '+inventory.length+' discovered route patterns to '+output);
