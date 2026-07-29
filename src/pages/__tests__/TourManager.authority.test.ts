import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/pages/TourManager.tsx", "utf8");

describe("TourManager authority boundary", () => {
  it("routes management actions through authoritative hooks", () => {
    expect(source).toContain('useTourCancellation');
    expect(source).toContain('useTourTravelRepair');
    expect(source).toContain('useTourCatchUp');

    expect(source).toContain('cancelTour.mutate(selectedTour.id');
    expect(source).toContain('syncMemberTravel.mutate(selectedTour.id)');
    expect(source).toContain('regenerateTravelLegs.mutate(selectedTour.id)');
    expect(source).toContain('catchUp.mutate({ tourId: selectedTour.id, profileId })');
  });

  it("contains no legacy browser-authoritative mutations", () => {
    const forbidden = [
      "const cancelTourMutation = useMutation",
      "const regenerateTravelLegsMutation = useMutation",
      "const addNewMemberTravelMutation = useMutation",
      "const catchUpToTourMutation = useMutation",
      '.from("tour_travel_legs").insert',
      '.from("player_travel_history").insert',
      '.from("player_scheduled_activities").insert',
      '.from("bands").update',
      '.from("profiles").update',
    ];

    for (const token of forbidden) {
      expect(source, `legacy authority remains: ${token}`).not.toContain(token);
    }
  });

  it("uses retained-history cancellation wording and UK currency", () => {
    expect(source).toContain("Completed shows and tour history will remain visible");
    expect(source).toContain("£1,500");
    expect(source).not.toContain("delete all associated gigs and travel legs");
    expect(source).not.toContain("$1,500 charter");
  });
});
