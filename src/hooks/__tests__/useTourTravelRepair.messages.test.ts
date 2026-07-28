import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("useTourTravelRepair source contract", () => {
  it("invalidates all tour travel caches after an authoritative mutation", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/hooks/useTourTravelRepair.ts"),
      "utf8",
    );

    expect(source).toContain('["tour-travel-legs"]');
    expect(source).toContain('["scheduled-activities"]');
    expect(source).toContain('["travel-status"]');
    expect(source).toContain('["travel-plans"]');
  });
});
