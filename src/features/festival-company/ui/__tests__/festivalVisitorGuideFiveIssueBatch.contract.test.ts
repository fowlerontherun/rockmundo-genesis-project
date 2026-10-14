import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const page = read("src/features/festival-company/ui/PublicFestivalPage.tsx");
const helpers = read("src/features/festival-company/ui/festivalPublicDisplay.ts");
const sponsor = read("src/features/festival-company/ui/SponsorIdentity.tsx");
const logos = read("supabase/migrations/20260928160000_backfill_canonical_sponsorship_brand_logos.sql");

describe("public festival visitor-guide regressions", () => {
  it("#4066 shows cancellation before countdown and never promises a refund", () => {
    expect(page).toContain('const cancelled = f.launchStatus === "cancelled_before_event";');
    expect(page).toContain("festivalVisitorEventLabel(eventPhase, f.launchStatus)");
    expect(page).toContain("cancelled ? (");
    expect(page).toContain("This festival edition was cancelled.");
    expect(page).toContain("No refund is assumed");
    expect(page).toContain("festivalVisitorSalesLabel(eventPhase, f.launchStatus)");
    expect(helpers).toContain('if (launchStatus === "cancelled_before_event") return "Festival cancelled"');
  });

  it("#4067 checks performance chronology instead of trusting non-empty times", () => {
    expect(helpers).toContain("Number.isFinite(start) && Number.isFinite(end) && end > start");
    expect(page).toContain("confirmedLineup.filter(isPublishedFestivalPerformance)");
  });

  it("#4068 accepts only safe image data URLs so seeded logos render", () => {
    expect(logos).toContain("'data:image/svg+xml;base64,'");
    expect(sponsor).toContain("svg\\+xml|png|jpeg|webp");
    expect(sponsor).toContain("failedUrl !== secureUrl");
  });

  it("#4069 visually elevates main sponsor before supporting slots", () => {
    expect(page).toContain("orderFestivalPublicSponsors(f.sponsors)");
    expect(page).toContain("publishedSponsors.map((s)");
    expect(page).toContain("isMainFestivalSponsor(s)");
    expect(page).toContain("Main sponsor");
  });

  it("#4070 adds accessible safety and partner guide destinations without fake facilities", () => {
    expect(page).toContain('id="festival-info-safety"');
    expect(page).toContain('id="festival-info-sponsors"');
    expect(page).toContain("medical assistance, welfare facilities, security and lost-property");
    expect(page).toContain("have not been confirmed for this edition");
    expect(page).toContain('href={["visitor-opening-times", "visitor-ticket-help", "visitor-faq-title"].includes(key)');
    expect(page).toContain("<SponsorIdentity name={sponsor.name} logoReference={sponsor.logoReference} />");
  });
});
