import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)));

function assertCompleteRegistryEntry(entry, label) {
  const externalEntry = !entry.link && !entry.resolved?.startsWith("file:");
  if (!externalEntry) return;
  assert.equal(typeof entry.version, "string", `${label} has no resolved version`);
  assert.ok(entry.resolved && entry.integrity, `${label} is an incomplete version-only stub`);
}

export function resolveLockDependency(packages, parentPath, dependency) {
  let cursor = parentPath;
  while (cursor) {
    const nested = `${cursor}/node_modules/${dependency}`;
    if (packages[nested]) return [nested, packages[nested]];
    const boundary = cursor.lastIndexOf("/node_modules/");
    cursor = boundary < 0 ? "" : cursor.slice(0, boundary);
  }
  const root = `node_modules/${dependency}`;
  return packages[root] ? [root, packages[root]] : null;
}

export function assertDependencyClosure(packages, parentPath, dependencies, label) {
  for (const dependency of Object.keys(dependencies ?? {})) {
    const resolved = resolveLockDependency(packages, parentPath, dependency);
    assert.ok(resolved, `${label} dependency ${dependency} has no resolvable package-lock entry`);
    assertCompleteRegistryEntry(resolved[1], `${label} dependency ${dependency}`);
  }
}

function assertDirectDependencies(packages, dependencies, label) {
  for (const dependency of Object.keys(dependencies ?? {})) {
    const path = `node_modules/${dependency}`;
    assert.ok(packages[path], `${label} dependency ${dependency} has no exact root package-lock entry`);
    assertCompleteRegistryEntry(packages[path], `${label} dependency ${dependency}`);
  }
}

test("root manifest and lock entry have identical complete dependency declarations", () => {
  const root = lock.packages[""];
  assert.deepEqual(root.dependencies, packageJson.dependencies);
  assert.deepEqual(root.devDependencies, packageJson.devDependencies);
  assertDirectDependencies(lock.packages, packageJson.dependencies, "manifest");
  assertDirectDependencies(lock.packages, packageJson.devDependencies, "manifest");
});

test("Testing Library direct entries retain registry metadata and resolvable closure", () => {
  for (const dependency of ["@testing-library/dom", "@testing-library/jest-dom", "@testing-library/react", "@testing-library/user-event"]) {
    assertDirectDependencies(lock.packages, { [dependency]: "*" }, "Testing Library regression");
    const path = `node_modules/${dependency}`;
    assertDependencyClosure(lock.packages, path, lock.packages[path].dependencies, dependency);
  }
});

test("a dependency may resolve from the correct nested lock-tree path", () => {
  const packages = {
    "node_modules/parent": { version: "1.0.0", resolved: "https://registry.npmjs.org/parent/-/parent-1.0.0.tgz", integrity: "sha512-parent" },
    "node_modules/parent/node_modules/child": { version: "2.0.0", resolved: "https://registry.npmjs.org/child/-/child-2.0.0.tgz", integrity: "sha512-child" },
  };
  assertDependencyClosure(packages, "node_modules/parent", { child: "2" }, "parent");
});

test("the integrity check rejects a missing transitive dependency", () => {
  const packages = { "node_modules/@testing-library/jest-dom": { version: "6.6.3" } };
  const parentPath = "node_modules/@testing-library/jest-dom";
  const dependency = "redent";
  assert.throws(
    () => assertDependencyClosure(packages, parentPath, { [dependency]: "*" }, "jest-dom"),
    new RegExp(`jest-dom dependency ${dependency} has no resolvable package-lock entry`),
  );
});
