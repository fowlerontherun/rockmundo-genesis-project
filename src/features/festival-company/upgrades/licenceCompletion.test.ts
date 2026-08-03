import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migrationPath =
  "supabase/migrations/20291218245600_festival_licence_and_manager_authority.sql";

describe("simplified Festival licence completion", () => {
  it("provides one server-authoritative apply, upgrade or renew action", () => {
    const migration = source(migrationPath);
    const repository = source(
      "src/features/festival-company/upgrades/repository.ts",
    );
    const workspace = source(
      "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx",
    );

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.apply_festival_company_licence",
    );
    expect(migration).toContain("action IN ('apply', 'upgrade', 'renew')");
    expect(migration).toContain("public.finance_debit_owner(");
    expect(migration).toContain("'company'");
    expect(repository).toContain('rpc("apply_festival_company_licence"');
    expect(workspace).toContain("Apply for");
    expect(workspace).toContain("Upgrade to");
    expect(workspace).toContain("Renew");
  });

  it("shows licence limits, expiry, requirements and company affordability", () => {
    const workspace = source(
      "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx",
    );
    const types = source("src/features/festival-company/upgrades/types.ts");

    expect(workspace).toContain("Attendance limit");
    expect(workspace).toContain("Maximum duration");
    expect(workspace).toContain("Maximum stages");
    expect(workspace).toContain("Expiry");
    expect(workspace).toContain("Available company funds");
    expect(types).toContain("FestivalLicenceRequirement");
    expect(types).toContain("validityDays");
    expect(types).toContain("renewalOpensAt");
  });

  it("keeps licence management simple rather than exposing permits", () => {
    const workspace = source(
      "src/features/festival-company/upgrades/FestivalUpgradeWorkspace.tsx",
    );

    expect(workspace).toContain(
      "permits and insurance are automatic simulation details",
    );
    expect(workspace).not.toContain("Permit application");
    expect(workspace).not.toContain("Insurance document");
    expect(workspace).not.toContain("Regulator review");
  });

  it("uses normal company-manager authority across the simplified journey", () => {
    const migration = source(migrationPath);

    expect(migration).toContain("public.can_manage_company(company.company_id)");
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.resolve_owner_festival_identifier[\s\S]*_festival_company_manager_authorized/,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_festival_company_setup[\s\S]*_festival_company_manager_authorized/,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_festival_company_editions[\s\S]*_festival_company_manager_authorized/,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.save_festival_edition_annual_plan[\s\S]*_festival_company_manager_authorized/,
    );
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\._festival_projection_authorized[\s\S]*_festival_company_manager_authorized/,
    );
  });

  it("protects licence charging with portable versioned receipts", () => {
    const migration = source(migrationPath);

    expect(migration).toContain("festival_licence_requests");
    expect(migration).toContain("p_expected_licence_version");
    expect(migration).toContain("FESTIVAL_LICENCE_VERSION_CONFLICT");
    expect(migration).toContain("FESTIVAL_LICENCE_IDEMPOTENCY_CONFLICT");
    expect(migration).toContain("payload_hash := md5(jsonb_build_object(");
    expect(migration).not.toMatch(
      /apply_festival_company_licence[\s\S]*payload_hash := encode\(digest/,
    );
    expect(migration).toContain("licence_result jsonb;");
    expect(migration).toContain("result = licence_result,");
    expect(migration).not.toContain("result = result,");
    expect(migration).toContain("pg_get_constraintdef(oid)");
    expect(migration).toContain(
      "'UNIQUE (festival_company_id, tier_key, status)'",
    );
    expect(migration).toContain("festival_company_one_active_licence");
    expect(migration).toContain(
      "PERFORM public._refresh_festival_company_edition_readiness(company.id)",
    );
  });
});
