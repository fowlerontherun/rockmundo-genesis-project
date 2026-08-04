import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20291218245700_reconcile_festival_setup_authority.sql";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const sqlFunction = (sql: string, name: string) => {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf("\n$$;", start);
  if (start < 0 || end < 0) throw new Error(`SQL function ${name} not found`);
  return sql.slice(start, end + 4);
};

describe("Festival setup authority reconciliation", () => {
  it("installs a self-contained company authority helper", () => {
    const definition = sqlFunction(
      source(migrationPath),
      "_festival_company_manager_authorized",
    );

    expect(definition).toContain("company.owner_id = auth.uid()");
    expect(definition).toContain("public.company_employees");
    expect(definition).not.toContain("can_manage_company");
  });

  it("reconciles the six-step configuration response contract", () => {
    const definition = sqlFunction(
      source(migrationPath),
      "_festival_configuration_result",
    );

    expect(definition).toContain("'annualMonth'");
    expect(definition).toContain("'vibes'");
    expect(definition).toContain("'siteTypes'");
    expect(definition).toContain("'environmentalPolicies'");
    expect(definition).toContain("public.festival_vibe_catalogue");
    expect(definition).toContain("public.festival_site_type_catalogue");
    expect(definition).toContain(
      "public.festival_environmental_policy_catalogue",
    );
  });

  it.each([
    "get_festival_configuration",
    "save_festival_configuration",
    "complete_festival_setup_with_edition",
  ])("uses normal company-manager authority in %s", (name) => {
    const definition = sqlFunction(source(migrationPath), name);

    expect(definition).toContain("_festival_company_manager_authorized");
    expect(definition).not.toContain("owner_profile_id <>");
    expect(definition).not.toContain("owner_profile_id IS DISTINCT FROM");
  });

  it("retains save concurrency and idempotency protections", () => {
    const definition = sqlFunction(
      source(migrationPath),
      "save_festival_configuration",
    );

    expect(definition).toContain("pg_advisory_xact_lock");
    expect(definition).toContain("p_expected_version");
    expect(definition).toContain("festival_configuration_stale");
    expect(definition).toContain("festival_configuration_idempotency_conflict");
    expect(definition).toContain("caller_profile_id = actor");
  });

  it("retains atomic first-edition completion protections", () => {
    const definition = sqlFunction(
      source(migrationPath),
      "complete_festival_setup_with_edition",
    );

    expect(definition).toContain("pg_advisory_xact_lock");
    expect(definition).toContain("festival_edition_creation_requests");
    expect(definition).toContain("configuration.configuration_version");
    expect(definition).toContain("first_annual_edition_created");
  });

  it("shows the real load failure and offers a retry", () => {
    const wizard = source(
      "src/features/festival-company/ui/FestivalConfigurationWizard.tsx",
    );

    expect(wizard).toContain("festivalConfigurationErrorMessage(query.error)");
    expect(wizard).toContain("query.refetch()");
    expect(wizard).not.toContain("Check that you own this");
  });
});
