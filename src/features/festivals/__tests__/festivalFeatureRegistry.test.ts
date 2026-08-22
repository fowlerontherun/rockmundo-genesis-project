import { describe, expect, it } from "vitest";
import {
  festivalFeatureRegistry,
  visibleFestivalFeatures,
} from "../festivalFeatureRegistry";

describe("festivalFeatureRegistry", () => {
  it("registers the simplified owner journey and supporting Festival areas", () => {
    expect(festivalFeatureRegistry.map((feature) => feature.id)).toEqual(
      expect.arrayContaining([
        "public-discovery",
        "public-detail",
        "company-home",
        "upgrades",
        "owner-editions",
        "annual-plan",
        "applications",
        "offers",
        "contracts",
        "setlists",
        "finance",
        "live-sessions",
        "outcomes",
        "stages",
        "slots",
        "staff",
        "permits",
        "insurance",
        "settlement",
        "legacy-records",
        "data-health",
        "admin-catalogue",
        "audit-log",
      ]),
    );
  });

  it("does not expose detailed event-operations workspaces to normal owners", () => {
    for (const id of [
      "contracts",
      "stages",
      "slots",
      "staff",
      "permits",
      "insurance",
      "settlement",
    ]) {
      expect(
        festivalFeatureRegistry.find((feature) => feature.id === id)
          ?.implementationStatus,
        id,
      ).toBe("backend_only");
    }
  });

  it("keeps the five annual owner screens visible", () => {
    const visibleIds = visibleFestivalFeatures.map((feature) => feature.id);
    expect(visibleIds).toEqual(
      expect.arrayContaining([
        "annual-plan",
        "applications",
        "finance",
        "live-sessions",
        "outcomes",
      ]),
    );
  });

  it("does not mark visible features without route, component, permissions and states", () => {
    for (const feature of visibleFestivalFeatures) {
      expect(feature.route).toMatch(/^\//);
      expect(feature.component.length).toBeGreaterThan(0);
      expect(feature.navigationParent.length).toBeGreaterThan(0);
      expect(feature.requiredPermission.length).toBeGreaterThan(0);
      expect(feature.emptyState.length).toBeGreaterThan(0);
      expect(feature.errorState.length).toBeGreaterThan(0);
      expect(feature.visibilityCondition.length).toBeGreaterThan(0);
    }
  });
});
