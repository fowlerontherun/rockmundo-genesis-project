import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const inventoryPath = path.resolve(
  __dirname,
  "../../../../docs/festivals/festival-domain-inventory.json",
);
const appPath = path.resolve(__dirname, "../../../App.tsx");

interface Route {
  path: string;
  kind: string;
  disposition: string;
}

const loadInventory = () => JSON.parse(fs.readFileSync(inventoryPath, "utf8")) as {
  routes: Route[];
};

describe("festival inventory registry", () => {
  it("classifies every festival route registered in App.tsx", () => {
    const app = fs.readFileSync(appPath, "utf8");
    const routeMatches = Array.from(
      app.matchAll(/path=\"([^\"]*festival[^\"]*)\"/gi),
    ).map((m) => m[1].startsWith("/") ? m[1] : `/${m[1]}`);

    const inventoryPaths = new Set(loadInventory().routes.map((r) => r.path));

    const missing = routeMatches.filter((p) => !inventoryPaths.has(p));
    expect(
      missing,
      `Add these routes to docs/festivals/festival-domain-inventory.json: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("uses only valid dispositions", () => {
    const valid = new Set([
      "remove",
      "replace",
      "reuse",
      "adapt",
      "archive",
      "unknown_requires_investigation",
    ]);
    for (const r of loadInventory().routes) {
      expect(valid.has(r.disposition), `bad disposition on ${r.path}: ${r.disposition}`).toBe(true);
    }
  });
});
