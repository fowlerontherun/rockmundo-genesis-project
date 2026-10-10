#!/usr/bin/env node
// Discovery-only inventory. No browser, network, or database access.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.existsSync(path.join(root,file)) ? fs.readFileSync(path.join(root,file),'utf8') : '';
const sources = ['src/App.tsx','src/features/festivals/routes.ts','src/config/hubNavigation.ts','src/config/fmNavigation.ts'];
const entries = new Map();
const festivalPatterns = new Map();
const festivalSource = read('src/features/festivals/routes.ts');
const festivalBlock = festivalSource.match(/export const festivalRoutePatterns\s*=\s*\{([\s\S]*?)\}\s*as const/);
if (festivalBlock) for (const m of festivalBlock[1].matchAll(/(\w+)\s*:\s*["'](\/[^"']+)["']/g)) festivalPatterns.set(m[1],m[2]);
const add = (route, file, kind) => {
  if (!route || route === '*' || route.includes('$') || route.includes('{')) return;
  const key = route.startsWith('/') ? route : '/' + route;
  const existing = entries.get(key) ?? {path:key,sources:[],discoveryKinds:[],status:'not-tested',testCases:[],issues:[]};
  if (!existing.sources.includes(file)) existing.sources.push(file);
  if (!existing.discoveryKinds.includes(kind)) existing.discoveryKinds.push(kind);
  entries.set(key,existing);
};
for (const file of sources) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (!source) { console.warn('Missing source:',file); process.exitCode = 1; continue; }
  for (const m of source.matchAll(/<Route\b[^>]*?\bpath\s*=\s*["']([^"']+)["']/gs))
    add(m[1],file,'jsx-route');
  for (const m of source.matchAll(/<Route\b[^>]*?\bpath\s*=\s*\{festivalRoutePatterns\.(\w+)\}/gs)) {
    const pattern = festivalPatterns.get(m[1]);
    if (pattern) add(pattern,file,'jsx-festival-route');
  }
  // Resolve nested festival edition sections expressed as the final URL segment.
  // They are children of the edition shell, not independent top-level routes.
  if (file === 'src/App.tsx' && /<Route\s+path=\{festivalRoutePatterns\.edition\}/.test(source)) {
    for (const m of source.matchAll(/<Route\b[^>]*?\bpath\s*=\s*\{festivalRoutePatterns\.(\w+)\.split\(["']\/["']\)\.at\(-1\)\}/gs)) {
      const pattern = festivalPatterns.get(m[1]);
      if (pattern && pattern.startsWith(festivalPatterns.get('edition') + '/')) add(pattern,file,'jsx-festival-route');
    }
  }
  // Festival edition child routes are relative expressions mounted under the edition shell.
  // Resolve only the known registry + final-segment expression, not arbitrary JSX.
  if (file === 'src/App.tsx' && source.includes('path={festivalRoutePatterns.edition}')) {
    for (const m of source.matchAll(/<Route\\b[^>]*?\\bpath\\s*=\\s*\\{festivalRoutePatterns\\.(\\w+)\\.split\\(["']\\/["']\\)\\.at\\(-1\\)\\}/gs)) {
      const pattern = festivalPatterns.get(m[1]);
      const parent = festivalPatterns.get('edition');
      if (pattern && parent && pattern.startsWith(parent + '/'))
        add(pattern,file,'jsx-festival-route');
    }
  }
  for (const m of source.matchAll(/\bpath\s*:\s*["'](\/[^"']*)["']/g))
    add(m[1],file,'navigation-or-config');
  for (const m of source.matchAll(/\brootPath\s*:\s*["'](\/[^"']*)["']/g))
    add(m[1],file,'navigation-or-config');
  for (const m of source.matchAll(/["'](\/[^"'\s]+)["']/g)) {
    if (file.endsWith('fmNavigation.ts') || file.endsWith('hubNavigation.ts'))
      add(m[1],file,'navigation-reference');
  }
  if (file.endsWith('festivals/routes.ts')) {
    const block = source.match(/export const festivalRoutePatterns\s*=\s*\{([\s\S]*?)\}\s*as const/);
    if (block) for (const m of block[1].matchAll(/:\s*["'](\/[^"']+)["']/g))
      add(m[1],file,'festival-route-pattern');
  }
}
// Dynamic JSX expressions, nested relative routes, and redirects require separate review.
const routes = [...entries.values()].sort((a,b)=>a.path.localeCompare(b.path));
const output = 'qa/route-inventory.json';
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify({
  generatedAt:new Date().toISOString(),
  sourceFiles:sources,
  routeCount:routes.length,
  limitations:[
    'Discovery only: no route has been executed or verified',
    'Navigation references may not resolve to registered routes',
    'Nested relative routes and JSX expression paths need manual resolution',
    'Dynamic routes need fixtures and role-aware browser tests',
    'Jobs, database operations, dialogs and workflows need separate inventories'
  ],routes
},null,2)+'\n');
console.log('Discovered '+routes.length+' candidate routes; all not-tested: '+output);
