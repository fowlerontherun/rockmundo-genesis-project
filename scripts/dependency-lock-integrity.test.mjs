import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const packageJson=JSON.parse(readFileSync(new URL("../package.json",import.meta.url)));
const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url)));

export function assertDeclaredPackagesPresent(packages,dependencies,label){
 for(const dependency of Object.keys(dependencies??{})){
  const root=`node_modules/${dependency}`;
  const nested=Object.keys(packages).some((entry)=>entry.endsWith(`/node_modules/${dependency}`));
  assert.ok(packages[root]||nested,`${label} dependency ${dependency} has no package-lock entry`);
 }
}

test("root manifest and lock entry have identical dependency declarations",()=>{
 const root=lock.packages[""];
 assert.deepEqual(root.dependencies,packageJson.dependencies);
 assert.deepEqual(root.devDependencies,packageJson.devDependencies);
});

test("jsdom exists and every dependency declared by its lock entry has a lock entry",()=>{
 const jsdom=lock.packages["node_modules/jsdom"];
 assert.ok(jsdom,"jsdom has no package-lock entry");
 assertDeclaredPackagesPresent(lock.packages,jsdom.dependencies,"jsdom");
});

test("the integrity check rejects a missing declared jsdom dependency",()=>{
 const packages=structuredClone(lock.packages);
 const dependency=Object.keys(packages["node_modules/jsdom"].dependencies)[0];
 for(const entry of Object.keys(packages)){
  if(entry===`node_modules/${dependency}`||entry.endsWith(`/node_modules/${dependency}`)) delete packages[entry];
 }
 assert.throws(
  ()=>assertDeclaredPackagesPresent(packages,{[dependency]:"*"},"jsdom"),
  new RegExp(`jsdom dependency ${dependency} has no package-lock entry`),
 );
});
