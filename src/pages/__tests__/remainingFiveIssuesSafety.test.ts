import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAudioDurationReviewCsv } from "@/lib/audioDurationAudit";
import {
  auditFestivalSponsorSlots, getPublishedFestivalCampingTickets,
} from "@/features/festival-company/ui/festivalPublicDisplay";
import type { FestivalPublicSponsor } from "@/features/festival-company/domain/festivalLaunch";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("five open-issue safety improvements", () => {
  it("#4082 has an authentication-first, POST-only sponsorship dry run with zero payouts", () => {
    const worker = source("supabase/functions/process-sponsorship-payments/index.ts");
    expect(worker).toContain("if (req.method !== 'POST')");
    const gate = worker.indexOf("if (cronAuthError || cronAuthorized !== true)");
    const dry = worker.indexOf("if (payload?.dryRun === true)");
    const settlement = worker.indexOf("'process_sponsorship_installment_atomic'");
    expect(gate).toBeGreaterThan(0);
    expect(dry).toBeGreaterThan(gate);
    expect(settlement).toBeGreaterThan(dry);
    expect(worker).toContain("paymentsPaid: 0");
    expect(worker).not.toContain("SUPABASE_SERVICE_ROLE_KEY ||");
  });

  it("#4119 refuses ambiguous or reserved gameplay treasuries before any trigger repair", () => {
    const repair = source("supabase/production-repairs/20261015_incremental_band_earnings_trigger.sql");
    expect(repair).toContain("HAVING count(*) <> 1");
    expect(repair).toContain("reserved_balance_minor > balance_minor");
    expect(repair).toContain("Unexpected production earnings trigger");
    expect(repair).toContain("v_next := v_band_balance + v_change.delta");
    expect(repair).toContain("Band earnings post-write treasury verification failed");
    expect(repair).toContain("DO NOT auto-run with db push");
  });

  it("#4064 exports decoded duration evidence and safely escapes song-title formulas", () => {
    const csv = buildAudioDurationReviewCsv([
      { id: "short", title: "=SUM(1,2)", duration_seconds: 200 },
      { id: "normal", title: "Song, with \"comma\"", duration_seconds: 160 },
      { id: "unknown", title: "@invalid", duration_seconds: 150 },
      { id: "not-checked", title: "Not checked", duration_seconds: 180 },
    ], { short: 22, normal: 160, unknown: null });
    expect(csv).toContain('"SHORT_REVIEW"');
    expect(csv).toContain('"WITHIN_TOLERANCE"');
    expect(csv).toContain('"UNVERIFIABLE"');
    expect(csv).toContain("\"'=SUM(1,2)\"");
    expect(csv).toContain('"Song, with ""comma"""');
    expect(csv).not.toContain("not-checked");
    const admin = source("src/pages/admin/AISongGeneration.tsx");
    expect(admin).toContain("Export audited CSV");
    expect(admin).toContain("buildAudioDurationReviewCsv(recentAudioSongs, audioAudit)");
  });

  it("#2182 audits one main, up to four supporters, identity duplicates and logo completeness", () => {
    const sponsor = (id: string, relationshipLabel: string, logoReference: string | null = "/brand.svg") =>
      ({ id, relationshipLabel, logoReference } as FestivalPublicSponsor);
    expect(auditFestivalSponsorSlots([sponsor("m", "Main sponsor"), ...[1,2,3,4].map(n => sponsor(String(n), "Supporting sponsor"))]).ready).toBe(true);
    expect(auditFestivalSponsorSlots([sponsor("m", "Main sponsor"), ...[1,2,3,4,5].map(n => sponsor(String(n), "Supporting sponsor"))]).ready).toBe(false);
    expect(auditFestivalSponsorSlots([sponsor("m", "Main sponsor"), sponsor("m", "Supporting sponsor")]).duplicateIds).toBe(true);
    expect(auditFestivalSponsorSlots([sponsor("m", "Main sponsor", null)]).missingLogos).toBe(1);
    const page = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(page).toContain("sponsorAudit.mainCount === 0");
    expect(page).toContain("No main sponsor has been announced");
  });

  it("#2183 derives campsite add-on guidance only from published ticket products", () => {
    const published = getPublishedFestivalCampingTickets([
      { name: "Camp Upgrade", ticketType: "camping_addon", productClass: "add_on", saleStatus: "on_sale" },
      { name: "General Admission", ticketType: "day", productClass: "admission", saleStatus: "on_sale" },
    ]);
    expect(published).toEqual([{ name: "Camp Upgrade", saleStatus: "on_sale" }]);
    expect(getPublishedFestivalCampingTickets([])).toEqual([]);
    const page = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(page).toContain("A camping add-on does not grant admission on its own.");
    expect(page).toContain("Site facilities are confirmed only by organiser-published information.");
    expect(page).toContain("No provision or staffing level is promised here.");
  });
});
