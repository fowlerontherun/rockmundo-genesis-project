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
      preferredMonth: 8,
      countryCode: "GB",
      cityId: "33333333-3333-4333-8333-333333333333",
      vibe: "alternative",
      siteType: "outdoor",
      durationDays: 3,
      environmentalPolicy: "responsible",
      festivalScale: "small",
      marketingEmphasis: "digital_buzz",
      expectedCapacity: 5000,
      estimatedOperatingCostMinor: 15000000,
      planningStatus: "ready",
      readinessScore: 100,
      version: 1,
      lockedAt: null,
      creationSource: "next_annual",
      editable: true,
      planBindings: {
        configuration: true,
        site: true,
        tickets: true,
        artists: true,
        operations: true,
        sponsorship: true,
        timetable: true,
      },
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
      editions: [
        {
          ...validResult.editions[0],
          festivalEditionId: "not-a-uuid",
          version: -1,
        },
      ],
    };
    expect(festivalCompanyEditionsSchema.safeParse(malformed).success).toBe(
      false,
    );
  });

  it("allows incomplete annual choices and unbound compatibility plans", () => {
    const incomplete = {
      ...validResult,
      editions: [
        {
          ...validResult.editions[0],
          startsOn: null,
          endsOn: null,
          preferredMonth: 6,
          expectedCapacity: null,
          festivalScale: null,
          marketingEmphasis: null,
          estimatedOperatingCostMinor: 0,
          planningStatus: "not_started",
          readinessScore: 0,
          planBindings: {
            ...validResult.editions[0].planBindings,
            site: false,
            tickets: false,
            artists: false,
            operations: false,
            sponsorship: false,
          },
        },
      ],
    };
    expect(festivalCompanyEditionsSchema.safeParse(incomplete).success).toBe(
      true,
    );
  });

  it("rejects incomplete plan-binding evidence", () => {
    const incompleteBindings = {
      ...validResult,
      editions: [
        {
          ...validResult.editions[0],
          planBindings: { configuration: true },
        },
      ],
    };
    expect(
      festivalCompanyEditionsSchema.safeParse(incompleteBindings).success,
    ).toBe(false);
  });
});

describe("festival edition directory SQL boundary", () => {
  const migration = readFileSync(
    "supabase/migrations/20291218245300_festival_simplified_annual_plan.sql",
    "utf8",
  );

  it("reads only the canonical Festival company and annual-edition aggregates", () => {
    expect(migration).toMatch(/FROM public\.festival_companies/i);
    expect(migration).toMatch(/FROM public\.festival_editions_v2/i);
    expect(migration).not.toMatch(
      /FROM public\.(?:festivals|festival_editions|game_events)\b/i,
    );
  });

  it("reports every edition-addressable compatibility-plan binding", () => {
    for (const table of [
      "festival_configurations",
      "festival_site_plans",
      "festival_ticket_plans",
      "festival_artist_programmes",
      "festival_operations_plans",
      "festival_sponsorship_plans",
      "festival_timetable_plans",
    ]) {
      expect(migration).toContain(`FROM public.${table} p`);
      expect(migration).toMatch(
        new RegExp(
          `${table}[\\s\\S]*p\\.festival_edition_id = edition\\.id`,
          "i",
        ),
      );
    }
  });

  it("requires an authenticated owner or administrator", () => {
    expect(migration).toMatch(/auth\.uid\(\) IS NULL OR actor IS NULL/i);
    expect(migration).toMatch(/company\.owner_profile_id <> actor/i);
    expect(migration).toMatch(
      /has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/i,
    );
  });

  it("keeps execution unavailable to public and anonymous roles", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_festival_company_editions\(uuid\) FROM PUBLIC, anon/i,
    );
  });
});

describe("canonical Festival owner route", () => {
  const source = readFileSync(
    "src/features/festivals/ui/CanonicalFestivalRoutes.tsx",
    "utf8",
  );

  it("mounts the setup wizard until the first annual edition is created", () => {
    expect(source).toContain('import { FestivalConfigurationWizard }');
    expect(source).toContain(
      "queryKey: festivalCompanySetupQueryKey(festivalCompanyId)",
    );
    expect(source).toMatch(
      /!festival\.setupCompleted[\s\S]*<FestivalConfigurationWizard festivalCompanyId=\{festivalCompanyId\}/,
    );
  });

  it("only exposes the annual-edition directory after initial setup", () => {
    expect(source).toMatch(
      /festival\.setupCompleted[\s\S]*festivalRoutes\.editions\(festival\.festivalCompanyId\)/,
    );
  });
});
