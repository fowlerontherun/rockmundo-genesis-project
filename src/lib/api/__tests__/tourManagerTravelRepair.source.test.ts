import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tour Manager travel repair migration", () => {
  it("documents the legacy direct-write paths that must be removed when wiring the hook", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/pages/TourManager.tsx"),
      "utf8",
    );

    expect(source).toContain("regenerateTravelLegsMutation");
    expect(source).toContain("addNewMemberTravelMutation");
  });
});
