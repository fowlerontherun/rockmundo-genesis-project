import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  auditFestivalSponsorSlots,
  orderFestivalPublicSponsors,
} from "@/features/festival-company/ui/festivalPublicDisplay";
import type { FestivalPublicSponsor } from "@/features/festival-company/domain/festivalLaunch";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const sponsor = (id: string, relationshipLabel: string): FestivalPublicSponsor => ({
  id, relationshipLabel, name: "Test Brand", category: "music",
  logoReference: "/test-logo.svg", sponsoredArea: null,
});

describe("remaining five-issue hardening regressions", () => {
  it("#2002 loads crowd clips into state and pauses playback on visibility and navigation", () => {
    const mixer = source("src/features/gig-experience/viewer/audio/useCrowdAmbience.ts");
    expect(mixer).toContain("setLibrary(sounds)");
    expect(mixer).toContain("const sounds = library;");
    expect(mixer).toContain("isDocumentHidden || typeof Audio");
    expect(mixer).toContain('window.addEventListener("pagehide", pageHide)');
    expect(mixer).toContain('window.addEventListener("pageshow", visibility)');
    expect(mixer).toContain('audio.removeAttribute("src")');
    expect(mixer).not.toContain("libraryRef.current = sounds");
  });

  it("#4064 ignores audio metadata results from older audit pages", () => {
    const admin = source("src/pages/admin/AISongGeneration.tsx");
    const start = admin.indexOf("const run = ++auditRunRef.current");
    const read = admin.indexOf("await readAudioDuration(", start);
    const guard = admin.indexOf("if (run !== auditRunRef.current) break", read);
    expect(start).toBeGreaterThan(0);
    expect(read).toBeGreaterThan(start);
    expect(guard).toBeGreaterThan(read);
    expect(admin).toContain("auditRunRef.current += 1");
    expect(admin).toContain("Export audited CSV");
  });

  it("#2182 publishes only one card per sponsor identity, with main role prioritised", () => {
    const duplicate = [
      sponsor("brand-one", "Supporting sponsor"),
      sponsor("brand-one", "Main sponsor"),
      sponsor("brand-two", "Supporting sponsor"),
    ];
    expect(auditFestivalSponsorSlots(duplicate).duplicateIds).toBe(true);
    const displayed = orderFestivalPublicSponsors(duplicate);
    expect(displayed).toHaveLength(2);
    expect(displayed[0].id).toBe("brand-one");
    expect(displayed[0].relationshipLabel).toBe("Main sponsor");
    expect(duplicate).toHaveLength(3); // No canonical contract mutation
    const visitorGuide = source("src/features/festival-company/ui/FestivalVisitorGuide.tsx");
    expect(visitorGuide).toContain("auditFestivalSponsorSlots(f.sponsors)");
    expect(visitorGuide).toContain("orderFestivalPublicSponsors(f.sponsors)");
    expect(visitorGuide).toContain("supporting = sponsors.filter((s) => !isMainFestivalSponsor(s)).slice(0, 4)");
  });

  it("#2183 provides keyboard-expandable visitor guide sections and confirmed location", () => {
    const page = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
    const guide = source("src/features/festival-company/ui/FestivalVisitorGuide.tsx");
    expect(page).toContain("<FestivalVisitorGuide edition={f}");
    expect(guide).toContain('<summary className="flex cursor-pointer');
    expect(guide).toContain('querySelector("details")?.setAttribute("open", "")');
    expect(guide).toContain("<strong>Confirmed destination:</strong> {f.city}, {f.country}");
    expect(guide).toContain("Routes, travel times and available parking are not assumed");
    expect(guide).toContain("A camping add-on never replaces admission.");
  });

  it("#4072 manifest is strictly read-only and refuses to assert schema effects", () => {
    const script = source("scripts/migration-identity-inventory.mjs");
    expect(script).toContain('schema_effects: "not_verified"');
    expect(script).toContain('deployment_decision: "manual_review_required"');
    expect(script).toContain("duplicate_timestamp_groups");
    expect(script).toContain("identical_sql_groups");
    expect(script).toContain("version_matched_unverified");
    expect(script).not.toContain("execute_sql");
    expect(script).toContain("Do not run supabase db push");
    expect(script).not.toContain("execSync(");
  });
});
