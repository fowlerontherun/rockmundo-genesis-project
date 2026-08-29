import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Tour Manager travel repair migration", () => {
  it("keeps travel repair behind the authoritative hooks", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/pages/TourManager.tsx"),
      "utf8",
    );

    expect(source).toContain("regenerateTravelLegs.mutate(selectedTour.id)");
    expect(source).toContain("syncMemberTravel.mutate(selectedTour.id)");
    expect(source).not.toContain("regenerateTravelLegsMutation");
    expect(source).not.toContain("addNewMemberTravelMutation");
  });
});
