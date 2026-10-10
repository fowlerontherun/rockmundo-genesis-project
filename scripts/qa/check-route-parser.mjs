#!/usr/bin/env node
// Inspect JSX route declarations that static route discovery may miss.
import fs from 'node:fs';
const source=fs.readFileSync('src/App.tsx','utf8')
  .replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const declarations=[...source.matchAll(/<Route\b[^>]*?\bpath\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*')/gs)];
const expressionRoutes=declarations.filter(m=>m[1].startsWith('{')).map(m=>({
  expression:m[1],line:source.slice(0,m.index).split('\n').length,
  status:'requires-review'
}));
const literals=declarations.filter(m=>!m[1].startsWith('{')).map(m=>m[1].slice(1,-1));
const counts=new Map();
for(const p of literals) counts.set(p,(counts.get(p)||0)+1);
const repeated=[...counts].filter(([,count])=>count>1).map(([path,count])=>({path,count,status:'requires-review'}));
const report={
  generatedAt:new Date().toISOString(),jsxDeclarations:declarations.length,
  expressionRouteCount:expressionRoutes.length,repeatedLiteralCount:repeated.length,
  warning:'Expression paths and repeated literals are review candidates. Nested routing can intentionally repeat names.',
  expressionRoutes,repeated
};
fs.writeFileSync('qa/route-parser-review.json',JSON.stringify(report,null,2)+'\n');
console.log('Route expressions to review:',expressionRoutes.length,'repeated literal paths:',repeated.length);
