import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { festivalVisitorContactLink } from "@/features/festival-company/ui/festivalPublicDisplay";
import { isSafeSponsorLogoReference } from "@/features/festival-company/ui/SponsorIdentity";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("next five open issue fixes", () => {
  it("#2002 pauses Top of the Pops crowd playback on hide/exit, resumes safely, and frees media", () => {
    const source = read("src/features/top-of-the-pops/useTotpAudienceAudio.ts");
    expect(source).toContain('window.addEventListener("pagehide", hide)');
    expect(source).toContain('window.addEventListener("pageshow", sync)');
    expect(source).toContain("if (!enabled || !playbackState.isPlaying || !pageVisible");
    expect(source).toContain("if (!active || !pageVisible || typeof Audio");
    expect(source).toContain("if (pendingReaction !== null) window.clearTimeout(pendingReaction)");
    expect(source).toContain('audio.removeAttribute("src")');
    expect(source).toContain("setLibrary(sounds)");
  });

  it("#4064 aborts page-switched audio metadata probes rather than exporting stale results", () => {
    const admin = read("src/pages/admin/AISongGeneration.tsx");
    const reader = read("src/lib/audioDurationAudit.ts");
    expect(admin).toContain("auditAbortRef.current?.abort()");
    expect(admin).toContain("new AbortController()");
    expect(admin).toContain("readAudioDuration(song.audio_url, 12000, controller.signal)");
    expect(reader).toContain('audio.addEventListener("durationchange", loaded)');
    expect(reader).toContain('signal?.addEventListener("abort", failed');
    expect(reader).toContain("Number.isFinite(audio.duration)");
  });

  it("#2182 restricts active new sponsor branding and protects admin/public image previews", () => {
    const admin = read("src/pages/admin/BrandsAdmin.tsx");
    expect(admin).toContain("if (form.active && !logo)");
    expect(admin).toContain("sponsorLogoNeedsArtworkReview(brand.logo_url)");
    expect(admin).toContain("if (logo && !isSafeSponsorLogoReference(logo))");
    expect(admin).toContain("<SponsorIdentity name={brand.name} logoReference={brand.logo_url} />");
    expect(isSafeSponsorLogoReference("https://cdn.example.com/logo.png")).toBe(true);
    expect(isSafeSponsorLogoReference("/assets/brand.svg")).toBe(true);
    expect(isSafeSponsorLogoReference("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(true);
    expect(isSafeSponsorLogoReference("javascript:alert(1)")).toBe(false);
    expect(isSafeSponsorLogoReference("http://old.example/logo.png")).toBe(false);
    expect(isSafeSponsorLogoReference("//evil.example/logo.svg")).toBe(false);
    expect(isSafeSponsorLogoReference("https://user:pass@cdn.example/logo.png")).toBe(false);
  });

  it("#2183 safely links only confirmed organiser contacts and hides unpublished camping panels", () => {
    expect(festivalVisitorContactLink("hello@example.org")).toBe("mailto:hello@example.org");
    expect(festivalVisitorContactLink("https://example.org/contact")).toBe("https://example.org/contact");
    expect(festivalVisitorContactLink("javascript:alert(1)")).toBe(null);
    expect(festivalVisitorContactLink("http://example.org")).toBe(null);
    expect(festivalVisitorContactLink("Please contact the organiser")).toBe(null);
    expect(festivalVisitorContactLink("https://user:pass@example.org/contact")).toBe(null);
    const page = read("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(page).toContain('key !== "camping" || campingPublished');
    expect(page).toContain("organiserContactLink");
    expect(page).toContain("Contact the organiser");
  });

  it("#4072 compares source SQL hashes but never asserts a production migration applied", () => {
    const inventory = read("scripts/migration-identity-inventory.mjs");
    expect(inventory).toContain("source_hash_mismatch_manual_review");
    expect(inventory).toContain("source_hash_matched_schema_unverified");
    expect(inventory).toContain("history_hash_collision_versions");
    expect(inventory).toContain('schema_effects: "not_verified"');
    expect(inventory).toContain('deployment_decision: "manual_review_required"');
  });
});
