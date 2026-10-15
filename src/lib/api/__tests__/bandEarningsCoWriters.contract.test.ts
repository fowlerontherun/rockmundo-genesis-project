import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("#4119: band earnings must be the only credit writer on journalled paths", () => {
  it("credits admin money only once and surfaces earnings failures", () => {
    const admin = source("src/pages/admin/FameFansGifting.tsx");
    expect(admin).not.toContain("updates.band_balance =");
    expect(admin).toContain("if (Object.keys(updates).length > 0)");
    expect(admin).toContain('from("band_earnings").insert');
    expect(admin).toContain("if (earningsError) throw earningsError");
  });

  it("does not directly add major event cash before inserting earnings", () => {
    const worker = source("supabase/functions/complete-major-event/index.ts");
    expect(worker).not.toMatch(/band_balance:\\s*\\(band\\.band_balance/);
    expect(worker).toContain("fame: (band.fame || 0) + fameGained");
    expect(worker).toContain("source: 'major_event'");
    expect(worker).toContain("metadata: { performance_id: performanceId }");
    expect(worker).toContain("if (bandUpdateError) throw bandUpdateError");
    expect(worker).toContain("if (earningsError) throw earningsError");
  });

  it("does not directly credit a release refund before posting earnings", () => {
    const dialog = source("src/components/releases/CancelReleaseDialog.tsx");
    expect(dialog).not.toContain('.update({ band_balance:');
    expect(dialog).toContain('source: "refund"');
    expect(dialog).toContain("metadata: { release_id: release.id }");
    expect(dialog).toContain("if (refundError) throw refundError");
    // This legacy multi-request flow still needs a server-side atomic,
    // idempotent cancellation before production replay/automatic retries.
    expect(dialog).toContain("TODO(#4119)");
  });
});
