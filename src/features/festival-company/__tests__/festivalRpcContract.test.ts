import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Contract gate for the recurring FESTIVAL_RPC_UNAVAILABLE class of bug:
 * every festival RPC name called from the frontend must be defined by a
 * migration. Unit tests mock the Supabase client, so they cannot catch a
 * renamed or never-deployed function — this file reads the real sources.
 */

const ROOT = process.cwd();

function walk(dir: string, match: (file: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...walk(full, match));
    } else if (match(entry)) {
      out.push(full);
    }
  }
  return out;
}

const isSource = (file: string) =>
  (file.endsWith(".ts") || file.endsWith(".tsx")) &&
  !file.endsWith(".test.ts") &&
  !file.endsWith(".test.tsx");

const CALL_SITE_DIRS = [join(ROOT, "src")];

const RPC_PATTERN = /\.rpc\(\s*["'`]([a-z0-9_]+)["'`]/g;

function collectCalledRpcNames(): Map<string, string[]> {
  const calls = new Map<string, string[]>();
  for (const dir of CALL_SITE_DIRS) {
    for (const file of walk(dir, isSource)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(RPC_PATTERN)) {
        const name = match[1];
        if (!name.includes("festival")) continue;
        const list = calls.get(name) ?? [];
        list.push(file.replace(`${ROOT}/`, ""));
        calls.set(name, list);
      }
    }
  }
  return calls;
}

function collectDefinedFunctionNames(): Set<string> {
  const defined = new Set<string>();
  const pattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?([a-z0-9_]+)/gi;
  for (const file of walk(join(ROOT, "supabase/migrations"), (name) => name.endsWith(".sql"))) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(pattern)) {
      defined.add(match[1].toLowerCase());
    }
  }
  return defined;
}

describe("festival RPC contract", () => {
  const called = collectCalledRpcNames();
  const defined = collectDefinedFunctionNames();

  it("finds festival RPC call sites to verify", () => {
    expect(called.size).toBeGreaterThan(20);
  });

  it("has a migration-defined function for every festival RPC called from the app", () => {
    const missing = [...called.entries()]
      .filter(([name]) => !defined.has(name))
      .map(([name, files]) => `${name} (called from ${files.join(", ")})`);
    expect(missing).toEqual([]);
  });

  it("keeps every migration-defined festival function callable by name only", () => {
    for (const name of called.keys()) {
      expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
