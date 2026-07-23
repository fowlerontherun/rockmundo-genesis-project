import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMPANY_CREATION_COSTS, COMPANY_TYPE_INFO, CORPORATE_TAX_RATES } from "@/types/company";
import { FESTIVAL_FOUNDING_COST, mapFestivalFoundingError } from "../domain/festivalCompany";

const originalMigration = readFileSync("supabase/migrations/20260723120000_secure_vip_festival_company_founding.sql", "utf8");
const hardeningMigration = readFileSync("supabase/migrations/20260723153000_harden_festival_company_founding.sql", "utf8");
const hookSource = readFileSync("src/hooks/useCompanies.ts", "utf8");
const repositorySource = readFileSync("src/features/festival-company/data/festivalCompanyRepository.ts", "utf8");
const appSource = readFileSync("src/App.tsx", "utf8");

describe("festival company secure founding foundation", () => {
  it("registers festival as a canonical company type with $0 starting balance metadata", () => {
    expect(COMPANY_CREATION_COSTS.festival).toEqual({ creationCost: 2_000_000, startingBalance: 0, weeklyOperatingCosts: 0 });
    expect(COMPANY_TYPE_INFO.festival.label).toBe("Festival Company");
    expect(CORPORATE_TAX_RATES.festival).toBe(0.22);
  });

  it("does not allow festival creation through the generic browser-controlled company hook", () => {
    expect(hookSource).toContain('input.company_type === "festival"');
    expect(hookSource).toContain("secure VIP festival RPC");
  });

  it("sends only user-entered fields plus idempotency key to the RPC", () => {
    expect(repositorySource).toContain('supabase.rpc("found_festival_company"');
    expect(repositorySource).toContain('supabase.rpc("get_festival_company_setup"');
    expect(repositorySource).toContain("p_company_name: input.companyName");
    expect(repositorySource).toContain("p_public_name: input.publicName");
    expect(repositorySource).not.toContain("foundingCost:");
    expect(repositorySource).not.toContain("owner_id");
    expect(repositorySource).not.toContain("company_type");
  });

  it("maps stable RPC errors to player-facing messages", () => {
    expect(mapFestivalFoundingError("festival_vip_required")).toMatch(/VIP subscription/);
    expect(mapFestivalFoundingError("insufficient_personal_funds")).toMatch(/\$2,000,000/);
    expect(mapFestivalFoundingError("idempotency_conflict")).toMatch(/already used/);
    expect(mapFestivalFoundingError("festival_request_in_progress")).toMatch(/processing/);
  });

  it("defines atomic SQL objects for secure founding and idempotency", () => {
    expect(FESTIVAL_FOUNDING_COST).toBe(2_000_000);
    expect(originalMigration).toContain("CREATE TABLE IF NOT EXISTS public.festival_companies");
    expect(originalMigration).toContain("UNIQUE(actor_user_id, idempotency_key)");
    expect(hardeningMigration).toContain("public._caller_profile_id()");
    expect(hardeningMigration).toContain("pg_advisory_xact_lock");
    expect(hardeningMigration).toContain("company_limit_reached");
    expect(hardeningMigration).toContain("festival_creation_disabled");
    expect(hardeningMigration).toContain("festival_company_founding_fee");
    expect(hardeningMigration).not.toContain("INSERT INTO public.company_transactions(company_id,transaction_type,amount");
  });

  it("registers the authorised setup route without LegacyFestivalGate", () => {
    expect(appSource).toContain('path="companies/festivals/:festivalCompanyId/setup" element={<FestivalCompanySetupPage />}');
    expect(appSource).not.toContain('path="companies/festivals/:festivalCompanyId/setup" element={<LegacyFestivalGate');
  });
});

import { parseFestivalCompanyCapabilities } from "../domain/festivalCapabilities";
import { disabledFestivalCompanyEligibility, parseFestivalCompanyEligibility } from "../domain/festivalEligibility";
import { parseFoundFestivalCompanyResult } from "../domain/festivalCompany";

describe("festival company strict RPC response parsing", () => {
  const uuid = "81290000-0000-4000-8000-000000000001";
  it("fails closed for malformed capability and eligibility payloads", () => {
    expect(parseFestivalCompanyCapabilities({ newFestivalSystemEnabled: true })).toEqual({
      newFestivalSystemEnabled: false,
      festivalCompanyCreationEnabled: false,
      festivalCompanyManagementEnabled: false,
      festivalConfigurationEnabled: false,
      companyLimit: 3,
    });
    expect(parseFestivalCompanyEligibility({ canFoundCompany: true, foundingCost: 2_000_000 })).toEqual(disabledFestivalCompanyEligibility);
  });

  it("rejects malformed founding results instead of updating caches", () => {
    expect(() => parseFoundFestivalCompanyResult({ companyId: uuid, festivalCompanyId: uuid, personalCash: 8_000_000, foundingCost: 1, idempotent: false })).toThrow("malformed_festival_founding_result");
  });

  it("accepts complete founding results with transaction ids", () => {
    expect(parseFoundFestivalCompanyResult({ companyId: uuid, festivalCompanyId: uuid, personalCash: 8_000_000, foundingCost: 2_000_000, idempotent: false, personalFinancialTransactionId: uuid })).toMatchObject({ companyId: uuid, festivalCompanyId: uuid, personalCash: 8_000_000 });
  });
});
