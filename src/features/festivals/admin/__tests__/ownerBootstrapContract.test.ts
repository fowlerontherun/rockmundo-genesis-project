import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { mapOwnerManagementBootstrap } from "../mappers";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260721120000_deploy_festival_owner_management_bootstrap.sql"),
  "utf8",
);

describe("festival owner bootstrap contract", () => {
  it("deploys the frontend RPC with the named p_identifier uuid argument", () => {
    expect(migration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.festival_owner_management_bootstrap\(p_identifier uuid\)/,
    );
    expect(migration).toMatch(/RETURNS jsonb/);
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.festival_owner_management_bootstrap\(uuid\) FROM PUBLIC/);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.festival_owner_management_bootstrap\(uuid\) TO authenticated/);
    expect(migration).toMatch(/auth\.uid\(\) IS NULL/);
    expect(migration).toMatch(/v_is_admin OR v_is_owner OR jsonb_array_length\(v_roles\) > 0/);
  });

  it("documents stable failure statuses used by owner, staff, admin and denied flows", () => {
    for (const status of [
      "ready",
      "no_editions",
      "not_found",
      "access_denied",
      "migration_blocked",
      "unauthenticated",
    ]) {
      expect(migration).toContain(status);
    }
  });

  it("maps the expected bootstrap response shape without unsafe fallback data", () => {
    const mapped = mapOwnerManagementBootstrap({
      status: "ready",
      input_id: "11111111-1111-1111-1111-111111111111",
      identifier_type: "festival_brand",
      festival: {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Rockmundo Fest",
        owner_type: "player",
        owner_profile_id: "33333333-3333-3333-3333-333333333333",
      },
      authority: {
        is_owner: true,
        is_admin: false,
        delegated_roles: ["operations_manager"],
        can_create_edition: true,
        can_manage: true,
      },
      editions: [
        {
          id: "44444444-4444-4444-4444-444444444444",
          festival_id: "22222222-2222-2222-2222-222222222222",
          title: "2026",
          edition_number: 1,
          status: "planning",
          start_at: "2026-08-01T00:00:00Z",
          end_at: "2026-08-03T00:00:00Z",
          city_name: "London",
          currency_code: "GBP",
        },
      ],
      preferred_edition_id: "44444444-4444-4444-4444-444444444444",
      migration: { required: false, issues: [] },
      available_actions: ["create_edition"],
      message: null,
    });

    expect(mapped.status).toBe("ready");
    expect(mapped.authority).toEqual({
      isOwner: true,
      isAdmin: false,
      delegatedRoles: ["operations_manager"],
      canCreateEdition: true,
      canManage: true,
    });
    expect(mapped.editions[0]).toMatchObject({ title: "2026", cityName: "London", currencyCode: "GBP" });
    expect(mapped.preferredEditionId).toBe("44444444-4444-4444-4444-444444444444");
  });
});
