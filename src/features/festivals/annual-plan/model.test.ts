import { describe, expect, it } from "vitest";
import {
  annualPlanDraftIsComplete,
  annualPlanToDraft,
  calculateAnnualPlanEndDate,
  festivalAnnualPlanSchema,
  getAnnualPlanCapacityProjection,
  type FestivalAnnualPlan,
} from "./model";

const validPlan: FestivalAnnualPlan = {
  festivalCompanyId: "11111111-1111-4111-8111-111111111111",
  festivalEditionId: "22222222-2222-4222-8222-222222222222",
  editionYear: 3,
  name: "RockMundo Festival",
  status: "draft",
  editable: true,
  version: 2,
  startsOn: "2026-08-14",
  endsOn: "2026-08-16",
  preferredMonth: 8,
  city: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "London",
    country: "United Kingdom",
    timezone: "Europe/London",
  },
  currencyCode: "GBP",
  siteType: "outdoor",
  festivalScale: "small",
  durationDays: 3,
  vibe: "alternative",
  environmentalPolicy: "responsible",
  marketingEmphasis: "digital_buzz",
  expectedCapacity: 2500,
  estimatedOperatingCostMinor: 18500000,
  planningStatus: "ready",
  readinessScore: 100,
  planningEffects: {
    capacity: 2500,
    potentialCapacity: 4200,
    licensedCapacity: 2500,
    licenceCapacityLimit: 2500,
    capacityRestrictedByLicence: true,
    marketingDemandBasisPoints: 11250,
  },
  blockers: [],
  canWrite: true,
  updatedAt: "2026-08-03T20:00:00.000Z",
  cities: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      name: "London",
      country: "United Kingdom",
      timezone: "Europe/London",
    },
  ],
  scales: [
    {
      key: "small",
      displayName: "Small",
      description: "A focused regional festival.",
      minimumCapacity: 1000,
      maximumCapacity: 5000,
      maximumDurationDays: 3,
      complexity: "Moderate",
    },
  ],
  vibes: [
    {
      key: "alternative",
      displayName: "Alternative",
      description: "Independent and discovery-led.",
    },
  ],
  siteTypes: [
    {
      key: "outdoor",
      displayName: "Outdoor",
      description: "Open-air festival site.",
    },
  ],
  environmentalPolicies: [
    {
      key: "responsible",
      displayName: "Responsible",
      description: "Reduce waste and travel impact.",
    },
  ],
  marketingEmphases: [
    {
      key: "digital_buzz",
      displayName: "Digital Buzz",
      description: "Build online momentum.",
      demandBasisPoints: 11250,
      costBasisPoints: 10500,
      reputationBasisPoints: 10000,
      localArtistBasisPoints: 2000,
    },
  ],
};

describe("festivalAnnualPlanSchema", () => {
  it("accepts the exact-edition annual planning contract", () => {
    expect(festivalAnnualPlanSchema.parse(validPlan)).toEqual(validPlan);
  });

  it("normalizes the authoritative ISO currency code", () => {
    expect(
      festivalAnnualPlanSchema.parse({ ...validPlan, currencyCode: "usd" })
        .currencyCode,
    ).toBe("USD");
  });

  it("rejects out-of-range readiness and malformed edition identity", () => {
    const malformed = {
      ...validPlan,
      festivalEditionId: "not-a-uuid",
      readinessScore: 101,
    };
    expect(festivalAnnualPlanSchema.safeParse(malformed).success).toBe(false);
  });
});

describe("simplified annual plan draft", () => {
  it("derives the exact Festival end date from start and duration", () => {
    expect(calculateAnnualPlanEndDate("2026-08-14", 3)).toBe("2026-08-16");
    expect(calculateAnnualPlanEndDate("2026-08-14", 0)).toBeNull();
  });

  it("requires the selected month to match the exact start date", () => {
    const draft = annualPlanToDraft(validPlan);
    expect(annualPlanDraftIsComplete(draft)).toBe(true);
    expect(
      annualPlanDraftIsComplete({ ...draft, preferredMonth: 9 }),
    ).toBe(false);
    expect(annualPlanDraftIsComplete({ ...draft, durationDays: 0 })).toBe(false);
  });

  it("uses company-derived catalogue defaults for a new annual Festival", () => {
    const draft = annualPlanToDraft({
      ...validPlan,
      startsOn: null,
      endsOn: null,
      preferredMonth: 6,
      city: null,
      siteType: null,
      festivalScale: null,
      durationDays: null,
      vibe: null,
      environmentalPolicy: null,
      marketingEmphasis: null,
      expectedCapacity: null,
      estimatedOperatingCostMinor: 0,
      planningStatus: "not_started",
      readinessScore: 0,
    });

    expect(draft.preferredMonth).toBe(6);
    expect(draft.cityId).toBe(validPlan.cities[0].id);
    expect(draft.festivalScale).toBe("small");
    expect(draft.marketingEmphasis).toBe("digital_buzz");
  });
});

describe("Festival annual capacity projection", () => {
  it("separates built capacity from currently licensed usable capacity", () => {
    expect(getAnnualPlanCapacityProjection(validPlan)).toEqual({
      potentialCapacity: 4200,
      licensedCapacity: 2500,
      licenceCapacityLimit: 2500,
      capacityRestrictedByLicence: true,
      reservedUntilLicenceUpgrade: 1700,
    });
  });

  it("falls back to expected capacity for older annual-plan payloads", () => {
    const projection = getAnnualPlanCapacityProjection({
      expectedCapacity: 1800,
      planningEffects: {},
    });

    expect(projection).toEqual({
      potentialCapacity: 1800,
      licensedCapacity: 1800,
      licenceCapacityLimit: null,
      capacityRestrictedByLicence: false,
      reservedUntilLicenceUpgrade: 0,
    });
  });

  it("detects a licence restriction even if an older payload omits the flag", () => {
    const projection = getAnnualPlanCapacityProjection({
      expectedCapacity: 2500,
      planningEffects: {
        potentialCapacity: 5150,
        licensedCapacity: 2500,
        licenceCapacityLimit: 2500,
      },
    });

    expect(projection.capacityRestrictedByLicence).toBe(true);
    expect(projection.reservedUntilLicenceUpgrade).toBe(2650);
  });
});
