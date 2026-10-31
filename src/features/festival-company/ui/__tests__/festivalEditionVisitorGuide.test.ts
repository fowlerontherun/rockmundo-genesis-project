import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseFestivalVisitorGuide, type FestivalPublicEdition,
} from "../../domain/festivalLaunch";
import { festivalGuideCampingAvailable, festivalGuideText } from "../FestivalVisitorGuide";
import { festivalVisitorContactLink } from "../festivalPublicDisplay";

const source = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const fixture = (options: Partial<FestivalPublicEdition> = {}): FestivalPublicEdition => ({
  information: {
    travel: "Company-wide directions", camping: null,
    accessibility: null, foodAndDrink: null, ageGuidance: null,
    terms: null, refundPolicy: null, contact: null,
  },
  visitorGuide: null, ticketProducts: [], sponsors: [],
  ...options,
} as FestivalPublicEdition);

describe("#2183 annual edition visitor guide", () => {
  it("keeps two published annual editions' notes isolated", () => {
    const first = fixture({ editionId: "old-edition", visitorGuide: parseFestivalVisitorGuide({
      siteStyle: "outdoor", sections: { site: "Riverside Field", transport: "Festival shuttle" },
    }) });
    const second = fixture({ editionId: "next-edition", visitorGuide: parseFestivalVisitorGuide({
      siteStyle: "indoor", sections: { site: "City Hall" },
    }) });
    expect(festivalGuideText(first, "site", null)).toEqual({
      text: "Riverside Field", editionSpecific: true,
    });
    expect(festivalGuideText(second, "site", null).text).toBe("City Hall");
    expect(festivalGuideText(second, "transport", second.information.travel)).toEqual({
      text: "Company-wide directions", editionSpecific: false,
    });
  });

  it("accepts missing optional fields from older public projections without inventing facts", () => {
    expect(parseFestivalVisitorGuide(null)).toBeNull();
    expect(parseFestivalVisitorGuide({ sections: {}, siteStyle: null })).toEqual({
      sections: {}, siteStyle: null, siteMapReference: null, verifiedSafety: null,
    });
    expect(() => parseFestivalVisitorGuide({ sections: { site: 42 } })).toThrow();
    expect(() => parseFestivalVisitorGuide({ sections: [] })).toThrow();
  });

  it("refuses to invent a campsite from old organiser text", () => {
    const base = fixture({
      information: { ...fixture().information, camping: "Old camping advice" },
      visitorGuide: parseFestivalVisitorGuide({ sections: { camping: "New edition campsite" } }),
    });
    expect(festivalGuideCampingAvailable(base)).toBe(false);
    expect(festivalGuideCampingAvailable(fixture({ ticketProducts: [{
      name: "Camping add-on", ticketType: "camping_addon",
      productClass: "add_on", saleStatus: "tickets_on_sale",
    } as FestivalPublicEdition["ticketProducts"][number]] }))).toBe(true);
  });

  it("keeps approved safety and site maps absent without a verified source", () => {
    const guide = parseFestivalVisitorGuide({
      sections: { site: "Confirmed site" }, siteMapReference: "javascript:alert(1)",
      verifiedSafety: { medical: "On site" },
    });
    expect(guide?.siteMapReference).toBeNull();
    expect(guide?.verifiedSafety).toBeNull();
    const visual = source("src/features/festival-company/ui/FestivalVisitorGuide.tsx");
    expect(visual).toContain("No staffing roster or operational readiness score is published");
    expect(visual).not.toContain("verifiedSafety.medical");
  });

  it("does not infer refunds, bypass safe contacts, or confuse upgrades with admission", () => {
    const guide = source("src/features/festival-company/ui/FestivalVisitorGuide.tsx");
    expect(guide).toContain('p.productClass === "admission"');
    expect(guide).toContain("Upgrades and add-ons do not grant admission");
    expect(guide).toContain("Refund eligibility is not assumed");
    expect(festivalVisitorContactLink("javascript:alert(1)")).toBeNull();
  });

  it("restricts editing to owner/admin; versions, idempotency and audit are server-side", () => {
    const sql = source("supabase/migrations/20261031121500_festival_edition_visitor_guide.sql");
    expect(sql).toContain("company.owner_profile_id = actor");
    expect(sql).toContain("public.has_role(auth.uid(), 'admin'");
    expect(sql).toContain("p_expected_version");
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("festival_visitor_guide_stale");
    expect(sql).toContain("festival_edition_visitor_guide_audit");
    expect(sql).toContain("festival_visitor_guide_historical_locked");
    expect(sql).toContain("guide.sections, '{}'::jsonb");
    expect(sql).toContain("REVOKE ALL ON public.festival_edition_visitor_guides");
    expect(sql).toContain("base := public.get_public_festival(p_slug)"); // preserve publication boundary
  });

  it("keeps keyboard-accessible accordions and main plus four sponsor slot cap", () => {
    const guide = source("src/features/festival-company/ui/FestivalVisitorGuide.tsx");
    expect(guide).toContain('<details className="group"');
    expect(guide).toContain('focus-visible:outline-primary');
    expect(guide).toContain('aria-label="Jump to visitor information"');
    expect(guide).toContain("supporting = sponsors.filter((s) => !isMainFestivalSponsor(s)).slice(0, 4)");
    const editor = source("src/features/festival-company/ui/FestivalEditionVisitorGuideEditor.tsx");
    expect(editor).toContain("festivalCompanyId, editionId");
    expect(editor).toContain("expectedVersion: guide.data.version");
  });
});
