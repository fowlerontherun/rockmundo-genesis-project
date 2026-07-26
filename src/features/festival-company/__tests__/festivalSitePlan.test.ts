import { describe, expect, it } from "vitest";
import {
  parseFestivalSitePlanResult,
  sitePlanToDraft,
} from "../domain/festivalSitePlan";
import {
  slugifyStage,
  validateSitePlanDraft,
} from "../domain/festivalSitePlanValidation";
const id = "123e4567-e89b-42d3-a456-426614174000";
const stage = {
  id: null,
  name: "Main Stage",
  slug: "main-stage",
  stageType: "main",
  sortOrder: 0,
  capacity: 500,
  minimumArtistFame: null,
  performanceAreaQuality: null,
  soundQuality: null,
  lightingQuality: null,
  productionComplexity: "standard",
  indoor: false,
  covered: true,
  accessibleViewingCapacity: 5,
  opensAt: "12:00",
  closesAt: "22:00",
  changeoverMinutes: 30,
  headlineSlotMinutes: 90,
  standardSlotMinutes: 45,
  status: "planned",
};
const sitePlan = {
  id: null,
  siteSource: "temporary_site",
  existingVenueId: null,
  siteName: "Park",
  siteType: "outdoor",
  siteDescription: "",
  cityId: id,
  timezone: "Europe/London",
  totalCapacity: 500,
  usableCapacity: 500,
  reservedCapacity: 0,
  minimumAge: null,
  curfewTime: "23:00",
  gatesOpenTime: "11:00",
  dailyOpenTime: "11:00",
  dailyCloseTime: "23:00",
  accessibilityNotes: "",
  transportNotes: "",
  weatherExposure: "exposed",
  groundCondition: "grass",
  status: "stages_configured",
};
const result = {
  festivalCompanyId: id,
  festivalName: "Test Fest",
  configurationStatus: "ready_for_planning",
  sitePlan,
  venueOptions: [],
  scaleLimits: {
    minimumSiteCapacity: 500,
    maximumSiteCapacity: 1000,
    minimumStages: 1,
    maximumStages: 1,
    maximumMainStageCapacity: 1000,
    maximumTotalStageCapacity: 1000,
    requiresSecondaryStage: false,
    requiresAccessibilityPlan: false,
  },
  stages: [stage],
  facilities: {
    toiletsRequired: 7,
    medicalPointsRequired: 1,
    securityPositionsRequired: 2,
    barsRecommended: 1,
    foodVendorSpacesRecommended: 2,
    waterPointsRequired: 1,
    accessibleViewingRequired: 5,
    backstageZonesRequired: 1,
    parkingRequirement: 125,
    transportRequirement: 350,
  },
  issues: [],
  ready: false,
  canWrite: true,
  planningVersion: 1,
  updatedAt: "2026-07-26T00:00:00Z",
  capacityMetrics: {
    largestStageCapacity: 500,
    totalStageCapacity: 500,
    mainStageShare: 100,
    accessibleViewingTotal: 5,
    peakCrowdConcentration: 100,
  },
};
describe("festival site plan domain", () => {
  it("strictly parses and copies canonical drafts", () => {
    const parsed = parseFestivalSitePlanResult(result);
    expect(sitePlanToDraft(parsed)?.stages[0].name).toBe("Main Stage");
  });
  it("rejects malformed capacities and times", () => {
    expect(() =>
      parseFestivalSitePlanResult({
        ...result,
        stages: [{ ...stage, capacity: -1 }],
      }),
    ).toThrow("malformed_festival_site_plan_result");
    expect(() =>
      parseFestivalSitePlanResult({
        ...result,
        stages: [{ ...stage, opensAt: "25:00" }],
      }),
    ).toThrow();
  });
  it("rejects duplicate stages", () =>
    expect(() =>
      parseFestivalSitePlanResult({
        ...result,
        stages: [stage, { ...stage, id: id }],
      }),
    ).toThrow());
  it("validates main stage and limits", () => {
    const draft = { sitePlan: { ...sitePlan }, stages: [] };
    expect(
      validateSitePlanDraft(draft, result.scaleLimits).map((x) => x.code),
    ).toContain("main_stage_required");
  });
  it("creates stable slugs", () =>
    expect(slugifyStage(" Emerging Stage! ")).toBe("emerging-stage"));
});
