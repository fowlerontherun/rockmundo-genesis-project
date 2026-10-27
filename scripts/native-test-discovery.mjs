import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Test suites written for node:test must not be loaded by Vitest. Vitest's
// transform changes import.meta.url, which breaks native filesystem contracts.
const roots = ["scripts", "tests", "workers"];
const importsNodeTest = /(?:from\s*["']node:test["']|require\(\s*["']node:test["']\s*\))/;
const importsVitest = /(?:from\s*["']vitest["']|require\(\s*["']vitest["']\s*\))/;

export function findNodeNativeTests(root = process.cwd()) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && /\.(?:test|spec)\.mjs$/.test(entry.name)) {
        const source = readFileSync(fullPath, "utf8");
        const node = importsNodeTest.test(source);
        const vitest = importsVitest.test(source);
        if (node && vitest) throw new Error(`Mixed test runners in ${fullPath}`);
        if (node) files.push(relative(root, fullPath).split(sep).join("/"));
      }
    }
  };
  for (const directory of roots) {
    const fullPath = resolve(root, directory);
    try { visit(fullPath); } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return files.sort();
}
