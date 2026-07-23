import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { COMPANY_CREATION_COSTS, COMPANY_TYPE_INFO, CORPORATE_TAX_RATES } from "@/types/company";
import { FESTIVAL_FOUNDING_COST, mapFestivalFoundingError } from "../domain/festivalCompany";

const migration = readFileSync("supabase/migrations/20260723120000_secure_vip_festival_company_founding.sql", "utf8");
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
  });

  it("defines atomic SQL objects for secure founding and idempotency", () => {
    expect(FESTIVAL_FOUNDING_COST).toBe(2_000_000);
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_companies");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_editions_v2");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_company_audit_log");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.festival_company_founding_requests");
    expect(migration).toContain("UNIQUE(actor_user_id, idempotency_key)");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_cost numeric := 2000000");
    expect(migration).toContain("balance,weekly_operating_costs) VALUES (v_user,v_company,'festival',p_description,0,0)");
    expect(migration).toContain("company_shareholders");
    expect(migration).toContain("company_transactions");
    expect(migration).toContain("festival_vip_required");
    expect(migration).toContain("insufficient_personal_funds");
    expect(migration).toContain("idempotency_conflict");
  });

  it("registers the new setup route without LegacyFestivalGate", () => {
    expect(appSource).toContain('path="companies/festivals/:festivalCompanyId/setup" element={<FestivalCompanySetupPlaceholder />}');
    expect(appSource).not.toContain('path="companies/festivals/:festivalCompanyId/setup" element={<LegacyFestivalGate');
  });
});
