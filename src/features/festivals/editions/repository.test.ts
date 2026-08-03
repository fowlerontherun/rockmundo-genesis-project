import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { festivalCompanyEditionsSchema } from "./repository";

const validResult = {
  festivalCompanyId: "11111111-1111-4111-8111-111111111111",
  publicName: "RockMundo Festival",
  companyStatus: "active",
  setupCompleted: true,
  canPlanNext: true,
  currentGameYear: 3,
  editions: [
    {
      festivalEditionId: "22222222-2222-4222-8222-222222222222",
      editionYear: 3,
      name: "RockMundo Festival",
      status: "draft",
      startsOn: "2026-08-10",
      endsOn: "2026-08-12",
      countryCode: "GB",
      cityId: "33333333-3333-4333-8333-333333333333",
      vibe: "alternative",
      siteType: "outdoor",
      durationDays: 3,
      environmentalPolicy: "responsible",
      festivalScale: "small",
      expectedCapacity: 5000,
      version: 1,
      lockedAt: null,
      creationSource: "next_annual",
      editable: true,
    },
  ],
};

describe("festivalCompanyEditionsSchema", () => {
  it("accepts the canonical owner edition read model", () => {
    expect(festivalCompanyEditionsSchema.parse(validResult)).toEqual(validResult);
  });

  it("rejects malformed edition identifiers and versions", () => {
    const malformed = {
      ...validResult,
      editions: [{ ...validResult.editions[0], festivalEditionId: "not-a-uuid", version: -1 }],
    };
    expect(festivalCompanyEditionsSchema.safeParse(malformed).success).toBe(false);
  });

  it("allows incomplete planning dates and capacity", () => {
    const incomplete = {
      ...validResult,
      editions: [{
        ...validResult.editions[0],
        startsOn: null,
        endsOn: null,
        expectedCapacity: null,
        festivalScale: null,
      }],
    };
    expect(festivalCompanyEditionsSchema.safeParse(incomplete).success).toBe(true);
  });
});

describe("festival edition directory SQL boundary", () => {
  const migration = readFileSync(
    "supabase/migrations/20291218245000_festival_owner_edition_directory.sql",
    "utf8",
  );

  it("reads only the canonical Festival company and annual-edition aggregates", () => {
    expect(migration).toMatch(/FROM public\.festival_companies/i);
    expect(migration).toMatch(/FROM public\.festival_editions_v2/i);
    expect(migration).not.toMatch(/FROM public\.(?:festivals|festival_editions|game_events)\b/i);
  });

  it("requires an authenticated owner or administrator", () => {
    expect(migration).toMatch(/auth\.uid\(\) IS NULL OR v_actor IS NULL/i);
    expect(migration).toMatch(/v_company\.owner_profile_id <> v_actor/i);
    expect(migration).toMatch(/has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/i);
  });

  it("keeps execution unavailable to public and anonymous roles", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.get_festival_company_editions\(uuid\) FROM PUBLIC, anon/i);
    expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_festival_company_editions\(uuid\) TO authenticated/i);
  });
});
