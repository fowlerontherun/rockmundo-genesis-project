import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const packageJson=JSON.parse(readFileSync(new URL("../package.json",import.meta.url)));
const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url)));

export function assertDeclaredPackagesPresent(packages,dependencies,label){
 for(const dependency of Object.keys(dependencies??{})){
  const root=`node_modules/${dependency}`;
  const entry=packages[root];
  assert.ok(entry,`${label} dependency ${dependency} has no root package-lock entry`);
  const externalEntry=!entry.link&&!entry.resolved?.startsWith("file:");
  if(externalEntry){
   assert.equal(typeof entry.version,"string",`${label} dependency ${dependency} has no resolved version`);
   assert.ok(entry.resolved&&entry.integrity,`${label} dependency ${dependency} is an incomplete version-only stub`);
  }
 }
}

test("root manifest and lock entry have identical dependency declarations",()=>{
 const root=lock.packages[""];
 assert.deepEqual(root.dependencies,packageJson.dependencies);
 assert.deepEqual(root.devDependencies,packageJson.devDependencies);
 assertDeclaredPackagesPresent(lock.packages,packageJson.dependencies,"manifest");
 assertDeclaredPackagesPresent(lock.packages,packageJson.devDependencies,"manifest");
});

test("testing-library direct entries retain registry metadata and dependency closure",()=>{
 for(const dependency of ["@testing-library/jest-dom","@testing-library/react","@testing-library/user-event"]){
  assertDeclaredPackagesPresent(lock.packages,{[dependency]:"*"},"testing-library regression");
  assertDeclaredPackagesPresent(lock.packages,lock.packages[`node_modules/${dependency}`].dependencies,dependency);
 }
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
  new RegExp(`jsdom dependency ${dependency} has no root package-lock entry`),
 );
});
