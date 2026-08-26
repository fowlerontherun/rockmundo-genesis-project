import { describe, expect, it } from "vitest";
import {
  calculateLiveSetup,
  getVenueSetupTarget,
  isPerformanceCrewRole,
} from "../liveSetup";

describe("liveSetup", () => {
  it("keeps the existing 12/8 equipment-to-crew balance as a 60/40 setup score", () => {
    const result = calculateLiveSetup({
      equipmentQuality: 80,
      crewSkill: 60,
      venueCapacity: 500,
    });

    expect(result.score).toBe(72);
    expect(result.equipmentScore).toBe(80);
    expect(result.crewScore).toBe(60);
  });

  it("uses venue size to make equipment quality meaningful", () => {
    expect(getVenueSetupTarget(100)).toEqual({ target: 45, label: "Basic" });
    expect(getVenueSetupTarget(800)).toEqual({ target: 70, label: "Professional" });
    expect(getVenueSetupTarget(6000)).toEqual({ target: 90, label: "World Class" });
  });

  it("only treats show-production staff as performance crew", () => {
    expect(isPerformanceCrewRole("Front of House Engineer")).toBe(true);
    expect(isPerformanceCrewRole("Lighting Director")).toBe(true);
    expect(isPerformanceCrewRole("Backline Technician")).toBe(true);
    expect(isPerformanceCrewRole("Tour Manager")).toBe(false);
    expect(isPerformanceCrewRole("Merch Director")).toBe(false);
    expect(isPerformanceCrewRole("Security Lead")).toBe(false);
    expect(isPerformanceCrewRole("Wardrobe Stylist")).toBe(false);
  });

  it("points the player to the weakest part of an undersized setup", () => {
    const weakEquipment = calculateLiveSetup({
      equipmentQuality: 45,
      crewSkill: 80,
      venueCapacity: 1500,
    });
    expect(weakEquipment.status).not.toBe("ready");
    expect(weakEquipment.recommendation).toContain("equipment");

    const weakCrew = calculateLiveSetup({
      equipmentQuality: 85,
      crewSkill: 45,
      venueCapacity: 1500,
    });
    expect(weakCrew.status).not.toBe("ready");
    expect(weakCrew.recommendation).toContain("Show Crew");
  });
});
