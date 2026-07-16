import { describe, expect, it } from "vitest";
import { festivalFeatureRegistry, visibleFestivalFeatures } from "../festivalFeatureRegistry";

describe("festivalFeatureRegistry", () => {
  it("registers all corrective festival visibility areas", () => {
    expect(festivalFeatureRegistry.map((feature) => feature.id)).toEqual(expect.arrayContaining([
      "public-discovery", "public-detail", "applications", "offers", "contracts", "setlists", "owner-editions", "stages", "slots", "staff", "permits", "insurance", "finance", "live-sessions", "outcomes", "settlement", "legacy-records", "data-health", "admin-catalogue", "audit-log",
    ]));
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
