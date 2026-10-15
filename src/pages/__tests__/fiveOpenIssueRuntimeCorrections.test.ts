import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { audioDurationReviewStatus, buildAudioDurationReviewCsv, isGeneratedAudioShort } from "@/lib/audioDurationAudit";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("five remaining open issue runtime corrections", () => {
  it("#4082 fails on unrecognised sponsorship RPC outcomes and never persists raw request bodies", () => {
    const worker = source("supabase/functions/process-sponsorship-payments/index.ts");
    const authIndex = worker.indexOf("if (cronAuthError || cronAuthorized !== true)");
    const bodyIndex = worker.indexOf("const payload = await safeJson");
    const settleIndex = worker.indexOf("'process_sponsorship_installment_atomic'");
    expect(authIndex).toBeGreaterThan(0);
    expect(bodyIndex).toBeGreaterThan(authIndex);
    expect(settleIndex).toBeGreaterThan(bodyIndex);
    expect(worker).toContain("requestPayload: safePayload");
    expect(worker).toContain("typeof amount !== 'number'");
    expect(worker).toContain("Unexpected atomic sponsorship settlement status");
    expect(worker).toContain("Invalid atomic sponsorship settlement amount");
    expect(worker).not.toContain("requestPayload: payload ?? null");
    expect(worker).toContain("if (payload?.dryRun === true)");
  });

  it("#2002 preserves initial TOTP cues until approval catalogue loads and replays after rewind", () => {
    const hook = source("src/features/top-of-the-pops/useTotpAudienceAudio.ts");
    expect(hook).toContain("const [libraryLoaded, setLibraryLoaded] = useState(false)");
    expect(hook).toContain("setLibraryLoaded(true)");
    expect(hook).toContain("if (!libraryLoaded) return");
    expect(hook.indexOf("if (!libraryLoaded) return")).toBeLessThan(hook.indexOf("if (cueId && cueId !== lastCueRef.current)"));
    expect(hook).toContain("playbackState.positionMs < lastPositionRef.current - 250");
    expect(hook).toContain("lastCueRef.current = null");
    expect(hook).toContain('previous.removeAttribute("src")');
  });

  it("#4064 distinguishes indeterminate duration from short and verified audio", () => {
    expect(audioDurationReviewStatus(null, 210)).toBe("UNVERIFIABLE");
    expect(audioDurationReviewStatus(Number.NaN, 210)).toBe("UNVERIFIABLE");
    expect(audioDurationReviewStatus(180, null)).toBe("LENGTH_UNKNOWN");
    expect(audioDurationReviewStatus(180, 0)).toBe("LENGTH_UNKNOWN");
    expect(audioDurationReviewStatus(20, 220)).toBe("SHORT_REVIEW");
    expect(audioDurationReviewStatus(200, 220)).toBe("WITHIN_TOLERANCE");
    expect(isGeneratedAudioShort(Number.NaN, 220)).toBe(false);
    const csv = buildAudioDurationReviewCsv(
      [{ id: "a", title: "Track", duration_seconds: null }], { a: 200 },
    );
    expect(csv).toContain('"LENGTH_UNKNOWN"');
    const admin = source("src/pages/admin/AISongGeneration.tsx");
    expect(admin).toContain("Planned length unknown");
  });

  it("#2183 validates public festival logo and preserves conflicts until a confirmed reload", () => {
    const editor = source("src/features/festival-company/ui/FestivalPublicProfileEditor.tsx");
    expect(editor).toContain("isSafeSponsorLogoReference(draft.logoReference.trim())");
    expect(editor).toContain('role="alert"');
    expect(editor).toContain("setVersionConflict(true)");
    expect(editor).toContain("Discard your unsaved changes and reload");
    expect(editor).toContain("versionConflict}>");
    expect(editor).toContain("if (Number(published?.publicVersion");
    expect(editor).toContain("setDirty(false)");
  });

  it("#2182 refuses duplicate fictional brand names including alternate casing and Unicode forms", () => {
    const admin = source("src/pages/admin/BrandsAdmin.tsx");
    expect(admin).toContain('name.normalize("NFKC").toLocaleLowerCase()');
    expect(admin).toContain('brand.id !== editingId');
    expect(admin).toContain('brand.name.trim().normalize("NFKC").toLocaleLowerCase() === identity');
    expect(admin).toContain("A canonical sponsor with this name already exists.");
    expect(admin).toContain("isSafeSponsorLogoReference(logo)");
  });
});
