import { describe, expect, it } from "vitest";
import {
  calculateLiveSetup,
  getBandEquipmentEffectiveScore,
  getCrewRoleInfo,
  getVenueSetupTarget,
  isPerformanceCrewRole,
  resolveBandEquipmentLiveSetup,
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

  it("describes the actual gameplay department and impact of each crew role", () => {
    expect(getCrewRoleInfo("Front of House Engineer")).toMatchObject({
      department: "show",
      departmentLabel: "Show Crew",
      affectsLiveSetup: true,
      impactLabel: "Live sound",
    });
    expect(getCrewRoleInfo("Tour Manager")).toMatchObject({
      department: "touring",
      departmentLabel: "Touring Operations",
      affectsLiveSetup: false,
      impactLabel: "Tour planning & logistics",
    });
    expect(getCrewRoleInfo("Merch Director")).toMatchObject({
      department: "commercial",
      departmentLabel: "Commercial & Image",
      affectsLiveSetup: false,
      impactLabel: "Merchandising",
    });
  });

  it("uses condition for a quarter of shared equipment effectiveness", () => {
    expect(getBandEquipmentEffectiveScore({ quality_rating: 80, condition_rating: 40 })).toBe(70);
    expect(getBandEquipmentEffectiveScore({ quality_rating: 80, condition_rating: 100 })).toBe(85);
  });

  it("honours explicit live setup selections instead of averaging all owned equipment", () => {
    const result = resolveBandEquipmentLiveSetup([
      { id: "selected", equipment_type: "pa", quality_rating: 90, condition_rating: 90, is_active: true },
      { id: "unused", equipment_type: "lights", quality_rating: 20, condition_rating: 20, is_active: false },
    ]);

    expect(result.selectionMode).toBe("selected");
    expect(result.selectedIds).toEqual(["selected"]);
    expect(result.score).toBe(90);
  });

  it("auto-selects the strongest item per equipment type when the band has no manual setup", () => {
    const result = resolveBandEquipmentLiveSetup([
      { id: "pa-old", equipment_type: "pa", quality_rating: 50, condition_rating: 50, is_active: false },
      { id: "pa-best", equipment_type: "pa", quality_rating: 90, condition_rating: 90, is_active: false },
      { id: "lights", equipment_type: "lights", quality_rating: 70, condition_rating: 70, is_active: false },
    ]);

    expect(result.selectionMode).toBe("automatic");
    expect(result.selectedIds).toEqual(["pa-best", "lights"]);
    expect(result.selectedCount).toBe(2);
    expect(result.score).toBe(80);
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
