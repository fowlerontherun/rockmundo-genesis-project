import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("tour travel repair authority", () => {
  it("keeps repair writes behind the shared RPC API", () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), "src/hooks/useTourTravelRepair.ts"),
      "utf8",
    );

    expect(source).toContain("regenerateTourTravelLegs(tourId)");
    expect(source).toContain("syncTourMemberTravel(tourId)");
    expect(source).not.toContain('.from("tour_travel_legs").insert');
    expect(source).not.toContain('.from("player_travel_history").insert');
    expect(source).not.toContain('.from("player_scheduled_activities").insert');
  });
});
