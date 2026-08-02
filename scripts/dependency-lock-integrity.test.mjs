import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const packageJson=JSON.parse(readFileSync(new URL("../package.json",import.meta.url)));
const lock=JSON.parse(readFileSync(new URL("../package-lock.json",import.meta.url)));

function assertDeclaredPackagesPresent(packages,dependencies,label){
 for(const dependency of Object.keys(dependencies??{})){
  assert.ok(packages[`node_modules/${dependency}`],`${label} dependency ${dependency} has no package-lock entry`);
 }
}

test("root manifest and lock entry have identical dependency declarations",()=>{
 const root=lock.packages[""];
 assert.deepEqual(root.dependencies,packageJson.dependencies);
 assert.deepEqual(root.devDependencies,packageJson.devDependencies);
});

test("every dependency declared by the installed jsdom package has a lock entry",()=>{
 const installedJsdom=JSON.parse(readFileSync(new URL("../node_modules/jsdom/package.json",import.meta.url)));
 assertDeclaredPackagesPresent(lock.packages,installedJsdom.dependencies,"jsdom");
});

test("the integrity check rejects a missing declared jsdom dependency",()=>{
 const packages=structuredClone(lock.packages);
 const dependency=Object.keys(packages["node_modules/jsdom"].dependencies)[0];
 delete packages[`node_modules/${dependency}`];
 assert.throws(
  ()=>assertDeclaredPackagesPresent(packages,{[dependency]:"*"},"jsdom"),
  new RegExp(`jsdom dependency ${dependency} has no package-lock entry`),
 );
});
