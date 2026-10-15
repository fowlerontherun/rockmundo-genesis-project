import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { auditFestivalSponsorSlots } from "@/features/festival-company/ui/festivalPublicDisplay";
import type { FestivalPublicSponsor } from "@/features/festival-company/domain/festivalLaunch";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const sponsor = (id: string, logoReference: string | null): FestivalPublicSponsor => ({
  id, name: "Approved Local Brand", relationshipLabel: "Main sponsor", category: "music",
  sponsoredArea: null, logoReference,
});

describe("five still-open issue regression checks", () => {
  it("#4064 bounds provider audio before MP3 validation and never logs a signed provider URL", () => {
    const webhook = source("supabase/functions/replicate-webhook/index.ts");
    const download = source("supabase/functions/_shared/boundedAudioDownload.ts");
    expect(webhook).toContain("assertSafeGeneratedAudioUrl(replicateAudioUrl)");
    expect(webhook).toContain("readBoundedGeneratedAudio(audioResponse)");
    expect(webhook).not.toContain("audioResponse.blob()");
    expect(webhook).not.toContain("replicateAudioUrl.substring");
    expect(download).toContain("MAX_GENERATED_MP3_BYTES = 32 * 1024 * 1024");
    expect(download).toContain("response.body.getReader()");
    expect(download).toContain("total > maxBytes");
    expect(download).toContain("reader.cancel()");
  });

  it("#2002 only consumes crowd reaction cooldown after playback really starts", () => {
    const crowd = source("src/features/gig-experience/viewer/audio/useCrowdAmbience.ts");
    expect(crowd).toContain("await audio.play()");
    expect(crowd).toContain("ref.current === audio && !audio.paused");
    expect(crowd).toContain("if (started) reactionCooldownRef.current.record");
    expect(crowd).toContain("pendingReactionRef.current = sound.id");
    expect(crowd).toContain("pendingReactionRef.current = null");
    expect(crowd).toContain('audio.removeAttribute("src")');
    expect(crowd).not.toContain("if (playClip(reactionRef, sound, level))");
  });

  it("#2183 filters historical unsafe logo and share-artwork URLs", () => {
    const festival = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(festival).toContain("isSafeSponsorLogoReference(f.logoReference)");
    expect(festival).toContain("isSafeSponsorLogoReference(f.heroImageReference)");
    expect(festival).toContain("verifiedFestivalArtwork");
    expect(festival).toContain("failedFestivalLogo !== verifiedFestivalLogo");
    expect(festival).not.toContain("artworkUrl: f.heroImageReference || f.logoReference");
  });

  it("#2182 treats unsafe URLs as missing sponsor assets, without hiding contracts", () => {
    const valid = [sponsor("1", "https://cdn.example/logo.webp")];
    expect(auditFestivalSponsorSlots(valid).missingLogos).toBe(0);
    expect(auditFestivalSponsorSlots([sponsor("1", "javascript:alert(1)")]).missingLogos).toBe(1);
    expect(auditFestivalSponsorSlots([sponsor("1", "http://old.example/logo.png")]).missingLogos).toBe(1);
    expect(auditFestivalSponsorSlots([sponsor("1", null)]).missingLogos).toBe(1);
    expect(auditFestivalSponsorSlots(valid).ready).toBe(true);
    const publicPage = source("src/features/festival-company/ui/PublicFestivalPage.tsx");
    expect(publicPage).toContain("Some partner logos are awaiting publication");
  });

  it("#4072 contradictory history cannot appear matched by cherry-picking one digest", () => {
    const inventory = source("scripts/migration-identity-inventory.mjs");
    expect(inventory).toContain("matchingHashes.size > 1");
    expect(inventory).toContain("conflicting_history_hashes_manual_review");
    expect(inventory).toContain('deployment_decision: "manual_review_required"');
    expect(inventory).toContain('schema_effects: "not_verified"');
  });
});
