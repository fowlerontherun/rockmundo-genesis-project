import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const VIEWER_ROOT = join(process.cwd(), "src/features/gig-experience/viewer");

const MUTATION_PATTERNS = [
  /\.insert\s*\(/,
  /\.upsert\s*\(/,
  /\.update\s*\(/,
  /\.delete\s*\(/,
  /supabase\s*\.\s*rpc\s*\(/,
  /functions\s*\.\s*invoke\s*\(/,
];

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "tests" || entry === "__tests__") return [];
      return collectSourceFiles(full);
    }
    if (!/\.(ts|tsx)$/.test(entry)) return [];
    if (/\.test\.(ts|tsx)$/.test(entry)) return [];
    return [full];
  });
}

describe("gig viewer authority", () => {
  const files = collectSourceFiles(VIEWER_ROOT);

  it("scans the whole viewer surface", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("never writes gig, inventory, settlement or finance state", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const pattern of MUTATION_PATTERNS) {
        if (pattern.test(source)) {
          offenders.push(`${file.replace(VIEWER_ROOT, "viewer")} → ${pattern.source}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
