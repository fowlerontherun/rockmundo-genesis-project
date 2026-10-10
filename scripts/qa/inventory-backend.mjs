#!/usr/bin/env node
// Filesystem-only inventory of backend surfaces. No network, credentials or DB access.
import fs from 'node:fs';
import path from 'node:path';
const groups=[
  {type:'edge-function',root:'supabase/functions',accept:(name,rel)=>rel.endsWith('/index.ts')||rel==='index.ts'},
  {type:'migration',root:'supabase/migrations',accept:name=>name.endsWith('.sql')},
  {type:'database-test',root:'supabase/tests',accept:name=>name.endsWith('.sql')},
];
function walk(dir,files=[]){
  if (!fs.existsSync(dir)) return files;
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(full,files);
    else if(ent.isFile()) files.push(full);
  }
  return files;
}
const surfaces=[];
for(const group of groups){
  for(const full of walk(group.root)){
    const relative=path.relative(group.root,full).split(path.sep).join('/');
    if(!group.accept(path.basename(full),relative)) continue;
    surfaces.push({type:group.type,path:full.split(path.sep).join('/'),status:'not-tested',owner:null,issues:[]});
  }
}
const output='qa/backend-inventory.json';
fs.mkdirSync('qa',{recursive:true});
fs.writeFileSync(output,JSON.stringify({
  generatedAt:new Date().toISOString(),surfaceCount:surfaces.length,
  counts:Object.fromEntries(groups.map(g=>[g.type,surfaces.filter(s=>s.type===g.type).length])),
  limitations:[
    'Filesystem discovery only; not a runtime or database audit',
    'RPCs, triggers, cron schedules and deployed functions require database/environment verification',
    'Migration files are historical artifacts, not a count of deployed objects',
    'No discovered item is considered tested'
  ],surfaces
},null,2)+'\n');
console.log('Discovered '+surfaces.length+' backend source surfaces (not tested)');
