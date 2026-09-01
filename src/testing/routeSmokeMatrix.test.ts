// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type RouteSmokeScenario = {
  id: string;
  label: string;
  states: string[];
  tests: string[];
};

type RouteSmokeManifest = {
  version: number;
  scenarios: RouteSmokeScenario[];
};

const manifest = JSON.parse(
  readFileSync("src/testing/route-smoke-matrix.json", "utf8"),
) as RouteSmokeManifest;

const requiredScenarioIds = [
  "unauthenticated",
  "new-player",
  "existing-player-desktop",
  "existing-player-mobile",
  "page-states",
  "browser-history",
];

const requiredStates = [
  "loading",
  "empty",
  "success",
  "error",
  "retry",
  "back",
  "forward",
  "replace",
];

describe("P4 route smoke matrix contract", () => {
  it("keeps every required player context represented", () => {
    expect(manifest.version).toBe(1);
    expect(manifest.scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining(requiredScenarioIds),
    );
  });

  it("covers all required route and page-state behaviours", () => {
    const states = new Set(manifest.scenarios.flatMap((scenario) => scenario.states));
    for (const state of requiredStates) expect(states.has(state)).toBe(true);
  });

  it("points only at executable test files that still exist", () => {
    const missing: string[] = [];

    for (const scenario of manifest.scenarios) {
      expect(scenario.label.trim().length).toBeGreaterThan(0);
      expect(scenario.tests.length).toBeGreaterThan(0);
      for (const testFile of scenario.tests) {
        expect(testFile).toMatch(/\.(test|spec)\.[cm]?[jt]sx?$/);
        if (!existsSync(resolve(testFile))) missing.push(`${scenario.id}: ${testFile}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("anchors desktop route coverage to the live route inventory rather than a static shortlist", () => {
    const desktop = manifest.scenarios.find((scenario) => scenario.id === "existing-player-desktop");
    expect(desktop?.tests).toContain("src/config/__tests__/routeOwnershipAudit.test.ts");
    expect(desktop?.tests).toContain("src/__tests__/App.p4RouteSmoke.test.tsx");
  });
});
