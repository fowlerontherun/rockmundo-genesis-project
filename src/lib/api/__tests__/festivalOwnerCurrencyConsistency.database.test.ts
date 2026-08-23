import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const canonicalCurrency = read(
  "supabase/migrations/20291218252400_festival_owner_currency_consistency.sql",
);
const canonicalSecurity = read(
  "supabase/migrations/20291218252500_harden_festival_upgrade_internal_helpers.sql",
);
const reconciliationCurrency = read(
  "supabase/reconciliation/festival/20260823_festival_owner_currency_consistency.sql",
);
const reconciliationSecurity = read(
  "supabase/reconciliation/festival/20260823_harden_festival_upgrade_internal_helpers.sql",
);
const annualPlan = read(
  "src/features/festivals/annual-plan/FestivalAnnualPlan.tsx",
);
const annualPlanModel = read(
  "src/features/festivals/annual-plan/model.ts",
);
const editions = read(
  "src/features/festivals/editions/FestivalCompanyEditionsPage.tsx",
);
const editionsRepository = read(
  "src/features/festivals/editions/repository.ts",
);
const upgrades = read(
  "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx",
);
const companyCard = read(
  "src/features/festival-company/ui/FestivalCompanyCard.tsx",
);
const companyRepository = read(
  "src/features/festival-company/data/festivalCompanyRepository.ts",
);

describe("Festival owner currency consistency", () => {
  it("projects city-derived currency into owner planning and directory RPCs", () => {
    for (const sql of [canonicalCurrency, reconciliationCurrency]) {
      expect(sql).toContain("'currencyCode'");
      expect(sql).toContain("_festival_projection_currency");
      expect(sql).toContain("get_festival_company_editions");
      expect(sql).toContain("get_owned_festival_companies");
    }
  });

  it("uses the projected currency instead of hard-coded GBP in owner financial screens", () => {
    expect(annualPlanModel).toContain("currencyCode");
    expect(annualPlan).toContain("data.currencyCode");
    expect(annualPlan).not.toContain('currency: "GBP"');

    expect(editionsRepository).toContain("currencyCode");
    expect(editions).toContain("edition.currencyCode");
    expect(editions).not.toContain('currency: "GBP"');

    expect(upgrades).toContain("query.data.currencyCode");
    expect(upgrades).not.toContain('currency: "GBP"');

    expect(companyRepository).toContain("currencyCode: string");
    expect(companyCard).toContain("festival.currencyCode");
    expect(companyCard).not.toContain('currency: "GBP"');
  });
});

describe("Festival upgrade helper authority", () => {
  it("keeps SECURITY DEFINER upgrade internals behind authorized public RPCs", () => {
    for (const sql of [canonicalSecurity, reconciliationSecurity]) {
      expect(sql).toContain(
        "REVOKE ALL ON FUNCTION public._festival_upgrade_state(uuid)",
      );
      expect(sql).toContain("FROM PUBLIC, anon, authenticated");
      expect(sql).toContain(
        "REVOKE ALL ON FUNCTION public._festival_company_balance_minor(uuid)",
      );
      expect(sql).toContain("TO service_role");
    }
  });
});
